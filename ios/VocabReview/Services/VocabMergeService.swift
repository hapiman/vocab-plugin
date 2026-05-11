import Foundation

enum VocabMergeService {
    static func mergeReviewFields(local: VocabMap, into remote: VocabMap) -> VocabMap {
        var merged = remote

        for (word, localWord) in local {
            guard var remoteWord = merged[word] else {
                continue
            }

            remoteWord.status = localWord.status
            remoteWord.lastSeen = localWord.lastSeen
            remoteWord.reviewCount = localWord.reviewCount
            remoteWord.correctCount = localWord.correctCount
            remoteWord.missCount = localWord.missCount
            remoteWord.intervalDays = localWord.intervalDays
            remoteWord.dueAt = localWord.dueAt
            remoteWord.lastReviewed = localWord.lastReviewed

            merged[word] = remoteWord
        }

        return merged
    }
}
