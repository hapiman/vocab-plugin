package com.vocabreview.data

import com.vocabreview.model.VocabMap
import com.vocabreview.model.VocabWord
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object GistClient {
    private val client = OkHttpClient()
    private const val GIST_FILE_NAME = "vocab-learner.json"

    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
        encodeDefaults = false
    }

    sealed class GistError(message: String) : Exception(message) {
        class Unauthorized : GistError("认证失败，请检查 Token")
        class Forbidden : GistError("访问被拒绝 (403)")
        class NotFound : GistError("Gist 不存在，请检查 ID")
        class HttpError(code: Int) : GistError("HTTP 错误: $code")
        class ParseError(msg: String) : GistError("解析失败: $msg")
    }

    suspend fun pull(token: String, gistId: String): VocabMap = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("https://api.github.com/gists/$gistId")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/vnd.github+json")
            .get()
            .build()

        val response = client.newCall(request).await()
        val code = response.code
        val body = response.body?.string() ?: ""

        when {
            code == 401 -> throw GistError.Unauthorized()
            code == 403 -> throw GistError.Forbidden()
            code == 404 -> throw GistError.NotFound()
            code !in 200..299 -> throw GistError.HttpError(code)
        }

        try {
            val gistObj = Json.parseToJsonElement(body).jsonObject
            val files = gistObj["files"]?.jsonObject ?: throw GistError.ParseError("no files")
            val vocabFile = files[GIST_FILE_NAME]?.jsonObject
                ?: throw GistError.ParseError("$GIST_FILE_NAME not found")
            val content = vocabFile["content"]?.jsonPrimitive?.content
                ?: throw GistError.ParseError("empty content")
            json.decodeFromString<Map<String, VocabWord>>(content)
        } catch (e: GistError) {
            throw e
        } catch (e: Exception) {
            throw GistError.ParseError(e.message ?: "unknown")
        }
    }

    suspend fun push(token: String, gistId: String, words: VocabMap): Unit = withContext(Dispatchers.IO) {
        val vocabJson = json.encodeToString(words)
        val payload = buildJsonObject {
            putJsonObject("files") {
                putJsonObject(GIST_FILE_NAME) {
                    put("content", vocabJson)
                }
            }
        }

        val requestBody = payload.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("https://api.github.com/gists/$gistId")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/vnd.github+json")
            .patch(requestBody)
            .build()

        val response = client.newCall(request).await()
        val code = response.code
        when {
            code == 401 -> throw GistError.Unauthorized()
            code == 403 -> throw GistError.Forbidden()
            code == 404 -> throw GistError.NotFound()
            code !in 200..299 -> throw GistError.HttpError(code)
            else -> {} // success
        }
    }

    private suspend fun Call.await(): Response = suspendCancellableCoroutine { cont ->
        cont.invokeOnCancellation { cancel() }
        enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (!cont.isCancelled) cont.resumeWithException(e)
            }

            override fun onResponse(call: Call, response: Response) {
                cont.resume(response)
            }
        })
    }
}
