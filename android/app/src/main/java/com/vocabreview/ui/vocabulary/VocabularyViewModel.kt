package com.vocabreview.ui.vocabulary

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vocabreview.data.VocabRepository
import com.vocabreview.model.VocabWord
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class VocabularyViewModel : ViewModel() {
    private val repo = VocabRepository.get()

    val words: StateFlow<Map<String, VocabWord>> = repo.words

    var searchQuery by mutableStateOf("")
        private set

    fun updateSearch(query: String) {
        searchQuery = query
    }

    fun filteredWords(mode: String): List<Pair<String, VocabWord>> {
        val all = words.value.entries
            .sortedByDescending { it.value.lastSeen ?: it.value.firstSeen ?: "" }

        val filtered = if (mode == "mastered") {
            all.filter { it.value.status == "mastered" }
        } else {
            if (searchQuery.isBlank()) {
                all.filter { it.value.status == "learning" }
            } else {
                all // search all words when query is active
            }
        }

        val query = searchQuery.lowercase()
        val searched = if (query.isBlank()) filtered else {
            filtered.filter { (word, vocab) ->
                word.contains(query) ||
                    (vocab.definition?.lowercase()?.contains(query) == true) ||
                    (vocab.phonetic?.lowercase()?.contains(query) == true) ||
                    (vocab.contexts?.any { it.sentence?.lowercase()?.contains(query) == true } == true)
            }
        }

        return searched.map { it.key to it.value }
    }

    fun deleteWord(word: String) {
        repo.deleteWord(word)
    }

    fun refresh() {
        viewModelScope.launch {
            repo.pullFromGist()
        }
    }
}
