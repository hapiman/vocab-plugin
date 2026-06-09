package com.vocabreview.ui.review

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.vocabreview.data.VocabRepository
import com.vocabreview.domain.ReviewScheduler
import com.vocabreview.model.ReviewOutcome
import com.vocabreview.model.VocabWord

class ReviewViewModel : ViewModel() {
    private val repo = VocabRepository.get()

    var queue by mutableStateOf<List<Pair<String, VocabWord>>>(emptyList())
        private set
    var currentIndex by mutableIntStateOf(0)
        private set
    var isFlipped by mutableStateOf(false)
        private set
    var showMasteredOverlay by mutableStateOf(false)
        private set

    val isQueueEmpty: Boolean get() = queue.isEmpty()
    val currentWord: Pair<String, VocabWord>? get() = queue.getOrNull(currentIndex)
    val progress: String get() = if (queue.isEmpty()) "0 / 0" else "${currentIndex + 1} / ${queue.size}"

    init {
        loadQueue()
    }

    private fun loadQueue() {
        queue = ReviewScheduler.dueQueue(repo.words.value).shuffled()
        currentIndex = 0
        isFlipped = false
    }

    fun flip() {
        isFlipped = !isFlipped
    }

    fun next() {
        if (currentIndex < queue.size - 1) {
            currentIndex++
            isFlipped = false
            showMasteredOverlay = false
        }
    }

    fun previous() {
        if (currentIndex > 0) {
            currentIndex--
            isFlipped = false
            showMasteredOverlay = false
        }
    }

    fun complete(outcome: ReviewOutcome) {
        val current = currentWord ?: return
        repo.applyReview(current.first, outcome)
        advance()
    }

    fun toggleMastered() {
        val current = currentWord ?: return
        val isMastered = current.second.status == "mastered"
        if (isMastered) {
            repo.updateStatus(current.first, "learning")
            // Refresh the current item in queue
            refreshCurrentItem()
        } else {
            repo.applyReview(current.first, ReviewOutcome.MASTERED)
            showMasteredOverlay = true
        }
    }

    fun advanceAfterMastered() {
        showMasteredOverlay = false
        advance()
    }

    private fun advance() {
        // Remove current from queue and stay at same index
        val mutable = queue.toMutableList()
        if (currentIndex < mutable.size) {
            mutable.removeAt(currentIndex)
        }
        queue = mutable
        if (currentIndex >= queue.size) {
            currentIndex = (queue.size - 1).coerceAtLeast(0)
        }
        isFlipped = false
    }

    private fun refreshCurrentItem() {
        val word = currentWord?.first ?: return
        val updated = repo.words.value[word] ?: return
        val mutable = queue.toMutableList()
        mutable[currentIndex] = word to updated
        queue = mutable
    }
}
