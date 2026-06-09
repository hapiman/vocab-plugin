package com.vocabreview.domain

import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

object DateCoding {
    private val isoFractional = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    private val isoPlain = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'")
    private val localMinute = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")

    fun nowMinute(): String {
        return LocalDateTime.now().format(localMinute)
    }

    fun nowIso(): String {
        return Instant.now().toString()
    }

    fun parseDue(str: String?): Instant? {
        if (str.isNullOrBlank()) return null
        return try {
            Instant.parse(str)
        } catch (_: DateTimeParseException) {
            try {
                LocalDateTime.parse(str, isoFractional).toInstant(ZoneOffset.UTC)
            } catch (_: DateTimeParseException) {
                try {
                    LocalDateTime.parse(str, isoPlain).toInstant(ZoneOffset.UTC)
                } catch (_: DateTimeParseException) {
                    try {
                        LocalDateTime.parse(str, localMinute)
                            .atZone(ZoneId.systemDefault()).toInstant()
                    } catch (_: DateTimeParseException) {
                        null
                    }
                }
            }
        }
    }

    fun formatDueDisplay(str: String?): String {
        val instant = parseDue(str) ?: return "未设置"
        val local = LocalDateTime.ofInstant(instant, ZoneId.systemDefault())
        return local.format(localMinute)
    }
}
