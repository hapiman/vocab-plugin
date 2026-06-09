package com.vocabreview.data

import android.content.Context
import com.vocabreview.domain.DateCoding
import com.vocabreview.domain.ReviewScheduler
import com.vocabreview.model.ReviewOutcome
import com.vocabreview.model.VocabMap
import com.vocabreview.model.VocabWord
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.atomic.AtomicInteger

class VocabRepository private constructor(private val context: Context) {

    companion object {
        @Volatile
        private var instance: VocabRepository? = null

        fun init(context: Context): VocabRepository {
            return instance ?: synchronized(this) {
                instance ?: VocabRepository(context.applicationContext).also { instance = it }
            }
        }

        fun get(): VocabRepository = instance
            ?: throw IllegalStateException("VocabRepository not initialized")
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val pushMutex = Mutex()
    private val localChangeRevision = AtomicInteger(0)
    private var needsPushAfterCurrentPush = false

    private val dirtyWords = mutableSetOf<String>()

    private val _words = MutableStateFlow<VocabMap>(emptyMap())
    val words: StateFlow<VocabMap> = _words.asStateFlow()

    private val _lastSyncAt = MutableStateFlow<String?>(null)
    val lastSyncAt: StateFlow<String?> = _lastSyncAt.asStateFlow()

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    val learningCount: Int get() = _words.value.count { it.value.status == "learning" }
    val masteredCount: Int get() = _words.value.count { it.value.status == "mastered" }
    val dueCount: Int get() = ReviewScheduler.dueQueue(_words.value).size

    fun loadCachedWords() {
        val cached = LocalCache.load(context)
        if (cached.isNotEmpty()) {
            _words.value = cached
        }
    }

    suspend fun pullFromGist(): Result<Unit> {
        val token = CredentialStore.getToken() ?: return Result.failure(Exception("未配置 Token"))
        val gistId = CredentialStore.getGistId() ?: return Result.failure(Exception("未配置 Gist ID"))

        _isLoading.value = true
        _lastError.value = null

        return try {
            val remote = GistClient.pull(token, gistId)
            val result = if (dirtyWords.isNotEmpty()) {
                VocabMergeService.merge(_words.value, remote, dirtyWords)
            } else {
                remote
            }
            _words.value = result
            LocalCache.save(context, result)
            _lastSyncAt.value = DateCoding.nowMinute()
            Result.success(Unit)
        } catch (e: Exception) {
            _lastError.value = e.message ?: "同步失败"
            Result.failure(e)
        } finally {
            _isLoading.value = false
        }
    }

    fun applyReview(word: String, outcome: ReviewOutcome) {
        val current = _words.value.toMutableMap()
        val entry = current[word] ?: return
        current[word] = ReviewScheduler.apply(entry, outcome)
        _words.value = current
        dirtyWords.add(word)
        saveLocalAndSchedulePush()
    }

    fun deleteWord(word: String) {
        val current = _words.value.toMutableMap()
        current.remove(word)
        _words.value = current
        dirtyWords.add(word)
        saveLocalAndSchedulePush()
    }

    fun updateStatus(word: String, status: String) {
        val current = _words.value.toMutableMap()
        val entry = current[word] ?: return
        val updated = entry.copy(
            status = status,
            lastSeen = DateCoding.nowMinute(),
            dueAt = if (status == "learning" && entry.status != "learning") {
                java.time.Instant.now().toString()
            } else entry.dueAt
        )
        current[word] = updated
        _words.value = current
        dirtyWords.add(word)
        saveLocalAndSchedulePush()
    }

    fun setDueNow(word: String) {
        val current = _words.value.toMutableMap()
        val entry = current[word] ?: return
        current[word] = entry.copy(
            status = "learning",
            dueAt = java.time.Instant.now().toString(),
            lastSeen = DateCoding.nowMinute()
        )
        _words.value = current
        dirtyWords.add(word)
        saveLocalAndSchedulePush()
    }

    private fun saveLocalAndSchedulePush() {
        LocalCache.save(context, _words.value)
        localChangeRevision.incrementAndGet()
        schedulePush()
    }

    private fun schedulePush() {
        scope.launch {
            pushReviewChanges()
        }
    }

    suspend fun pushIfNeeded() {
        if (localChangeRevision.get() > 0) {
            pushReviewChanges()
        }
    }

    private suspend fun pushReviewChanges() {
        if (!pushMutex.tryLock()) {
            needsPushAfterCurrentPush = true
            return
        }

        try {
            do {
                needsPushAfterCurrentPush = false
                val revisionBefore = localChangeRevision.get()

                val token = CredentialStore.getToken() ?: break
                val gistId = CredentialStore.getGistId() ?: break

                try {
                    val remote = GistClient.pull(token, gistId)
                    val snapshot = dirtyWords.toSet()
                    val merged = VocabMergeService.merge(_words.value, remote, snapshot)
                    GistClient.push(token, gistId, merged)
                    _words.value = merged
                    LocalCache.save(context, merged)

                    if (localChangeRevision.compareAndSet(revisionBefore, 0)) {
                        dirtyWords.removeAll(snapshot)
                    } else {
                        needsPushAfterCurrentPush = true
                    }
                } catch (e: Exception) {
                    _lastError.value = "推送失败: ${e.message}"
                    break
                }
            } while (needsPushAfterCurrentPush)
        } finally {
            pushMutex.unlock()
        }
    }
}
