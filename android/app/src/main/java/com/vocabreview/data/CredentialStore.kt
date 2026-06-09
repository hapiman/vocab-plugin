package com.vocabreview.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

object CredentialStore {
    private const val PREF_NAME = "vocab_secure_prefs"
    private const val KEY_TOKEN = "github_token"
    private const val KEY_GIST_ID = "gist_id"

    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        if (prefs != null) return
        val masterKey = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        prefs = EncryptedSharedPreferences.create(
            PREF_NAME,
            masterKey,
            context.applicationContext,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveCredentials(token: String, gistId: String) {
        prefs?.edit()
            ?.putString(KEY_TOKEN, token)
            ?.putString(KEY_GIST_ID, gistId)
            ?.apply()
    }

    fun getToken(): String? = prefs?.getString(KEY_TOKEN, null)

    fun getGistId(): String? = prefs?.getString(KEY_GIST_ID, null)

    fun normalizeGistId(input: String): String {
        val trimmed = input.trim()
        // Support full Gist URL: https://gist.github.com/user/abc123...
        val regex = Regex("[0-9a-fA-F]{20,64}")
        val match = regex.find(trimmed)
        return match?.value ?: trimmed
    }
}
