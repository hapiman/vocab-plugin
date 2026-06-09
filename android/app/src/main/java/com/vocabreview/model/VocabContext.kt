package com.vocabreview.model

import kotlinx.serialization.Serializable

@Serializable
data class VocabContext(
    val sentence: String? = null,
    val url: String? = null,
    val date: String? = null
)
