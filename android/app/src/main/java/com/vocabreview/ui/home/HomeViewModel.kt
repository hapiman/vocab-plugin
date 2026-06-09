package com.vocabreview.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vocabreview.data.VocabRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalTime

class HomeViewModel : ViewModel() {
    private val repo = VocabRepository.get()

    val words = repo.words
    val lastSyncAt = repo.lastSyncAt
    val lastError = repo.lastError
    val isLoading = repo.isLoading

    val greeting: String
        get() {
            val hour = LocalTime.now().hour
            return when {
                hour < 6 -> "夜深了"
                hour < 12 -> "早上好"
                hour < 14 -> "中午好"
                hour < 18 -> "下午好"
                else -> "晚上好"
            }
        }

    val dueCount: Int get() = repo.dueCount
    val learningCount: Int get() = repo.learningCount
    val masteredCount: Int get() = repo.masteredCount

    fun syncGist() {
        viewModelScope.launch {
            repo.pullFromGist()
        }
    }
}
