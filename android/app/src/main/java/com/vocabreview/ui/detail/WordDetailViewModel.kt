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
            statusMessage = "已重新加入学习队列"
        } else {
            repo.updateStatus(word, "mastered")
            statusMessage = "已标记为掌握"
        }
    }

    fun setDueToday(word: String) {
        repo.setDueNow(word)
        statusMessage = "已设为今天复习"
    }
}
