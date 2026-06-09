import Foundation

enum ReviewOutcome: String {
    case miss
    case hard
    case good
    case skip
    case mastered
}

struct ReviewResult {
    var word: VocabWord
    var nextDueText: String
}

enum ReviewScheduler {
    private static let goodIntervals = [1, 3, 7, 14, 30, 60, 120]

    static func isDue(_ word: VocabWord, now: Date = Date()) -> Bool {
        guard word.status == "learning" else { return false }
        guard let due = DateCoding.parseDue(word.dueAt) else { return true }
        return due <= now
    }

    static func apply(_ outcome: ReviewOutcome, to word: VocabWord, now: Date = Date()) -> ReviewResult {
        var updated = word
        updated.lastSeen = DateCoding.localMinuteString(now)

        if outcome == .mastered {
            updated.status = "mastered"
            updated.lastReviewed = DateCoding.isoString(now)
            return ReviewResult(word: updated, nextDueText: "已掌握")
        }

        updated.status = "learning"
        ensureReviewFields(&updated, now: now)

        switch outcome {
        case .skip:
            updated.dueAt = DateCoding.isoString(now.addingTimeInterval(4 * 60 * 60))
            return ReviewResult(word: updated, nextDueText: "4 小时后")
        case .miss:
            updated.reviewCount = (updated.reviewCount ?? 0) + 1
            updated.missCount = (updated.missCount ?? 0) + 1
            updated.intervalDays = 0
            updated.lastReviewed = DateCoding.isoString(now)
            updated.dueAt = DateCoding.isoString(now.addingTimeInterval(10 * 60))
            return ReviewResult(word: updated, nextDueText: "10 分钟后")
        case .hard:
            updated.reviewCount = (updated.reviewCount ?? 0) + 1
            updated.intervalDays = 1
            updated.lastReviewed = DateCoding.isoString(now)
            updated.dueAt = DateCoding.isoString(now.addingTimeInterval(24 * 60 * 60))
            return ReviewResult(word: updated, nextDueText: "明天")
        case .good:
            updated.reviewCount = (updated.reviewCount ?? 0) + 1
            updated.correctCount = (updated.correctCount ?? 0) + 1
            let interval = nextGoodIntervalDays(correctCount: updated.correctCount ?? 0)
            updated.intervalDays = interval
            updated.lastReviewed = DateCoding.isoString(now)
            updated.dueAt = DateCoding.isoString(now.addingTimeInterval(TimeInterval(interval * 24 * 60 * 60)))
            return ReviewResult(word: updated, nextDueText: "\(interval) 天后")
        case .mastered:
            return ReviewResult(word: updated, nextDueText: "已掌握")
        }
    }

    static func dueQueue(from words: VocabMap, now: Date = Date()) -> [(String, VocabWord)] {
        words
            .filter { _, word in word.status == "learning" }
            .sorted { lhs, rhs in
                let leftDue = isDue(lhs.value, now: now) ? 0 : 1
                let rightDue = isDue(rhs.value, now: now) ? 0 : 1
                if leftDue != rightDue { return leftDue < rightDue }
                let leftDate = DateCoding.parseDue(lhs.value.dueAt) ?? .distantPast
                let rightDate = DateCoding.parseDue(rhs.value.dueAt) ?? .distantPast
                return leftDate < rightDate
            }
    }

    private static func ensureReviewFields(_ word: inout VocabWord, now: Date) {
        word.reviewCount = word.reviewCount ?? 0
        word.correctCount = word.correctCount ?? 0
        word.missCount = word.missCount ?? 0
        word.intervalDays = word.intervalDays ?? 0
        word.dueAt = word.dueAt ?? DateCoding.isoString(now)
    }

    private static func nextGoodIntervalDays(correctCount: Int) -> Int {
        let index = min(max(correctCount - 1, 0), goodIntervals.count - 1)
        return goodIntervals[index]
    }
}
