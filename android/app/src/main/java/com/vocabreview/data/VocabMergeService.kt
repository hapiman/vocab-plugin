package com.vocabreview.data

import com.vocabreview.model.VocabMap
import com.vocabreview.model.VocabWord

object VocabMergeService {
    /**
     * Merge local review changes into remote data.
     * Strategy: start with remote as base, only overwrite review fields for locally-dirty words.
     * Words deleted remotely are not re-added.
     */
    fun merge(local: VocabMap, remote: VocabMap, dirtyWords: Set<String>): VocabMap {
        val merged = remote.toMutableMap()

        for (word in dirtyWords) {
            val localEntry = local[word] ?: continue
            val remoteEntry = merged[word] ?: continue // skip if deleted remotely
            merged[word] = remoteEntry.copy(
                status = localEntry.status ?: remoteEntry.status,
                lastSeen = localEntry.lastSeen ?: remoteEntry.lastSeen,
                reviewCount = localEntry.reviewCount ?: remoteEntry.reviewCount,
                correctCount = localEntry.correctCount ?: remoteEntry.correctCount,
                missCount = localEntry.missCount ?: remoteEntry.missCount,
                intervalDays = localEntry.intervalDays ?: remoteEntry.intervalDays,
                dueAt = localEntry.dueAt ?: remoteEntry.dueAt,
                lastReviewed = localEntry.lastReviewed ?: remoteEntry.lastReviewed
            )
        }

        return merged
    }
}
