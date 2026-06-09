package com.vocabreview.domain

import com.vocabreview.model.ReviewOutcome
import com.vocabreview.model.VocabWord
import java.time.Instant
import java.time.temporal.ChronoUnit

object ReviewScheduler {

    private val goodIntervals = intArrayOf(1, 3, 7, 14, 30, 60, 120)

    fun isDue(word: VocabWord): Boolean {
        if (word.status != "learning") return false
        val dueAt = DateCoding.parseDue(word.dueAt) ?: return true
        return !Instant.now().isBefore(dueAt)
    }

    fun apply(word: VocabWord, outcome: ReviewOutcome): VocabWord {
        val now = Instant.now()
        val nowIso = now.toString()
        val nowMinute = DateCoding.nowMinute()

        return when (outcome) {
            ReviewOutcome.MISS -> word.copy(
                status = "learning",
                lastSeen = nowMinute,
                lastReviewed = nowIso,
                reviewCount = (word.reviewCount ?: 0) + 1,
                missCount = (word.missCount ?: 0) + 1,
                intervalDays = 0,
                dueAt = now.plus(10, ChronoUnit.MINUTES).toString()
            )

            ReviewOutcome.HARD -> word.copy(
                status = "learning",
                lastSeen = nowMinute,
                lastReviewed = nowIso,
                reviewCount = (word.reviewCount ?: 0) + 1,
                intervalDays = 1,
                dueAt = now.plus(24, ChronoUnit.HOURS).toString()
            )

            ReviewOutcome.GOOD -> {
                val newCorrect = (word.correctCount ?: 0) + 1
                val idx = (newCorrect - 1).coerceIn(0, goodIntervals.size - 1)
                val interval = goodIntervals[idx]
                word.copy(
                    status = "learning",
                    lastSeen = nowMinute,
                    lastReviewed = nowIso,
                    reviewCount = (word.reviewCount ?: 0) + 1,
                    correctCount = newCorrect,
                    intervalDays = interval,
                    dueAt = now.plus(interval.toLong(), ChronoUnit.DAYS).toString()
                )
            }

            ReviewOutcome.SKIP -> word.copy(
                lastSeen = nowMinute,
                dueAt = now.plus(4, ChronoUnit.HOURS).toString()
            )

            ReviewOutcome.MASTERED -> word.copy(
                status = "mastered",
                lastSeen = nowMinute,
                lastReviewed = nowIso
            )
        }
    }

    fun dueQueue(words: Map<String, VocabWord>): List<Pair<String, VocabWord>> {
        return words.entries
            .filter { it.value.status == "learning" }
            .sortedWith(compareBy(
                { if (isDue(it.value)) 0 else 1 },
                { DateCoding.parseDue(it.value.dueAt)?.toEpochMilli() ?: 0L }
            ))
            .filter { isDue(it.value) }
            .map { it.key to it.value }
    }
}
