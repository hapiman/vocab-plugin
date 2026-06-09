package com.vocabreview.model

import kotlinx.serialization.*
import kotlinx.serialization.descriptors.*
import kotlinx.serialization.encoding.*
import kotlinx.serialization.json.*

typealias VocabMap = Map<String, VocabWord>
typealias MutableVocabMap = MutableMap<String, VocabWord>

@Serializable(with = VocabWordSerializer::class)
data class VocabWord(
    val status: String? = null,
    val firstSeen: String? = null,
    val lastSeen: String? = null,
    val contexts: List<VocabContext>? = null,
    val definition: String? = null,
    val phonetic: String? = null,
    val reviewCount: Int? = null,
    val correctCount: Int? = null,
    val missCount: Int? = null,
    val intervalDays: Int? = null,
    val dueAt: String? = null,
    val lastReviewed: String? = null,
    val additionalFields: Map<String, JsonElement> = emptyMap()
)

object VocabWordSerializer : KSerializer<VocabWord> {
    override val descriptor: SerialDescriptor =
        buildClassSerialDescriptor("VocabWord")

    private val knownKeys = setOf(
        "status", "firstSeen", "lastSeen", "contexts", "definition",
        "phonetic", "reviewCount", "correctCount", "missCount",
        "intervalDays", "dueAt", "lastReviewed"
    )

    override fun deserialize(decoder: Decoder): VocabWord {
        val jsonDecoder = decoder as JsonDecoder
        val obj = jsonDecoder.decodeJsonElement().jsonObject

        val contextsElement = obj["contexts"]
        val contexts: List<VocabContext>? = contextsElement?.let {
            if (it is JsonArray) {
                Json.decodeFromJsonElement<List<VocabContext>>(it)
            } else null
        }

        val additional = obj.filterKeys { it !in knownKeys }

        return VocabWord(
            status = obj["status"]?.jsonPrimitive?.contentOrNull,
            firstSeen = obj["firstSeen"]?.jsonPrimitive?.contentOrNull,
            lastSeen = obj["lastSeen"]?.jsonPrimitive?.contentOrNull,
            contexts = contexts,
            definition = obj["definition"]?.jsonPrimitive?.contentOrNull,
            phonetic = obj["phonetic"]?.jsonPrimitive?.contentOrNull,
            reviewCount = obj["reviewCount"]?.jsonPrimitive?.intOrNull,
            correctCount = obj["correctCount"]?.jsonPrimitive?.intOrNull,
            missCount = obj["missCount"]?.jsonPrimitive?.intOrNull,
            intervalDays = obj["intervalDays"]?.jsonPrimitive?.intOrNull,
            dueAt = obj["dueAt"]?.jsonPrimitive?.contentOrNull,
            lastReviewed = obj["lastReviewed"]?.jsonPrimitive?.contentOrNull,
            additionalFields = additional
        )
    }

    override fun serialize(encoder: Encoder, value: VocabWord) {
        val jsonEncoder = encoder as JsonEncoder
        val map = buildMap<String, JsonElement> {
            // Write additionalFields first (will be overwritten by known fields if conflict)
            putAll(value.additionalFields)
            // Write known fields
            value.status?.let { put("status", JsonPrimitive(it)) }
            value.firstSeen?.let { put("firstSeen", JsonPrimitive(it)) }
            value.lastSeen?.let { put("lastSeen", JsonPrimitive(it)) }
            value.contexts?.let { put("contexts", Json.encodeToJsonElement(it)) }
            value.definition?.let { put("definition", JsonPrimitive(it)) }
            value.phonetic?.let { put("phonetic", JsonPrimitive(it)) }
            value.reviewCount?.let { put("reviewCount", JsonPrimitive(it)) }
            value.correctCount?.let { put("correctCount", JsonPrimitive(it)) }
            value.missCount?.let { put("missCount", JsonPrimitive(it)) }
            value.intervalDays?.let { put("intervalDays", JsonPrimitive(it)) }
            value.dueAt?.let { put("dueAt", JsonPrimitive(it)) }
            value.lastReviewed?.let { put("lastReviewed", JsonPrimitive(it)) }
        }
        jsonEncoder.encodeJsonElement(JsonObject(map))
    }
}
