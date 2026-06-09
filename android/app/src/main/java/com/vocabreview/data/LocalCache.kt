package com.vocabreview.data

import android.content.Context
import com.vocabreview.model.VocabMap
import com.vocabreview.model.VocabWord
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

object LocalCache {
    private const val FILE_NAME = "vocab-learner.json"

    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
        encodeDefaults = false
    }

    fun load(context: Context): VocabMap {
        val file = File(context.filesDir, FILE_NAME)
        if (!file.exists()) return emptyMap()
        return try {
            val content = file.readText()
            json.decodeFromString<Map<String, VocabWord>>(content)
        } catch (_: Exception) {
            emptyMap()
        }
    }

    fun save(context: Context, words: VocabMap) {
        val file = File(context.filesDir, FILE_NAME)
        val content = json.encodeToString(words)
        file.writeText(content)
    }
}
