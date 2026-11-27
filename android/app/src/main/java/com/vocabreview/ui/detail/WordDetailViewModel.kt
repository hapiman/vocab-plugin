package com.vocabreview.ui.detail

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.vocabreview.data.VocabRepository
import com.vocabreview.model.VocabWord

class WordDetailViewModel : ViewModel() {
    private val repo = VocabRepository.get()

    var statusMessage by mutableStateOf<String?>(null)
        private set

    fun getWord(word: String): VocabWord? = repo.words.value[word]

    fun toggleStatus(word: String) {
        val current = getWord(word) ?: return
        if (current.status == "mastered") {
            repo.updateStatus(word, "learning")
            statusMessage = "Added back to the learning queue"
        } else {
            repo.updateStatus(word, "mastered")
            statusMessage = "Marked as mastered"
        }
    }

    fun setDueToday(word: String) {
        repo.setDueNow(word)
        statusMessage = "Scheduled for review today"
    }
}
