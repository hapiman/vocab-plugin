package com.vocabreview.ui.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vocabreview.data.CredentialStore
import com.vocabreview.data.VocabRepository
import kotlinx.coroutines.launch

class SettingsViewModel : ViewModel() {
    private val repo = VocabRepository.get()

    var token by mutableStateOf(CredentialStore.getToken() ?: "")
        private set
    var gistId by mutableStateOf(CredentialStore.getGistId() ?: "")
        private set
    var statusMessage by mutableStateOf<String?>(null)
        private set
    var isError by mutableStateOf(false)
        private set
    var isLoading by mutableStateOf(false)
        private set

    fun updateToken(value: String) { token = value }
    fun updateGistId(value: String) { gistId = value }

    fun save() {
        val normalizedId = CredentialStore.normalizeGistId(gistId)
        CredentialStore.saveCredentials(token.trim(), normalizedId)
        gistId = normalizedId
        statusMessage = "Settings saved"
        isError = false
    }

    fun pullFromGist() {
        save()
        isLoading = true
        viewModelScope.launch {
            val result = repo.pullFromGist()
            isLoading = false
            result.fold(
                onSuccess = {
                    statusMessage = "Pull successful: ${repo.words.value.size} words"
                    isError = false
                },
                onFailure = { e ->
                    statusMessage = e.message ?: "Pull failed"
                    isError = true
                }
            )
        }
    }
}
