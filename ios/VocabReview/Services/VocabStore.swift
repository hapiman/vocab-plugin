import Foundation

@MainActor
final class VocabStore {
    static let shared = VocabStore()

    private let cache = LocalCache()
    private let gistClient = GistClient()
    private let keychain = KeychainStore.shared
    private let gistIdKey = "gistId"
    private let tokenKey = "githubToken"

    private(set) var words: VocabMap = [:]
    private(set) var lastSyncAt: Date?
    private(set) var lastError: String?
    private var hasLocalReviewChanges = false
    private var localChangeRevision = 0
    private var isPushingReviewChanges = false
    private var needsPushAfterCurrentPush = false

    private init() {}

    var learningCount: Int {
        words.values.filter { $0.status == "learning" }.count
    }

    var masteredCount: Int {
        words.values.filter { $0.status == "mastered" }.count
    }

    var dueCount: Int {
        ReviewScheduler.dueQueue(from: words).filter { ReviewScheduler.isDue($0.1) }.count
    }

    var sortedDueQueue: [(String, VocabWord)] {
        ReviewScheduler.dueQueue(from: words).filter { ReviewScheduler.isDue($0.1) }
    }

    var allWordsSorted: [(String, VocabWord)] {
        words.sorted { lhs, rhs in
            let left = lhs.value.lastSeen ?? lhs.value.firstSeen ?? ""
            let right = rhs.value.lastSeen ?? rhs.value.firstSeen ?? ""
            return left > right
        }
    }

    func loadCachedWords() {
        do {
            words = try cache.load()
            lastError = nil
        } catch {
            lastError = "读取本地缓存失败：\(error.localizedDescription)"
        }
    }

    func saveCredentials(token: String, gistId: String) {
        do {
            let normalizedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
            let normalizedGistId = GistClient.normalizedGistId(from: gistId)
            try keychain.set(normalizedToken, for: tokenKey)
            UserDefaults.standard.set(normalizedGistId, forKey: gistIdKey)
            lastError = nil
        } catch {
            lastError = "保存 Token 失败：\(error.localizedDescription)"
        }
    }

    func loadCredentials() -> (token: String, gistId: String) {
        let token = (try? keychain.get(tokenKey)) ?? ""
        let gistId = UserDefaults.standard.string(forKey: gistIdKey) ?? ""
        return (token, gistId)
    }

    func pullFromGist() async {
        let credentials = loadCredentials()
        guard !credentials.token.isEmpty, !credentials.gistId.isEmpty else {
            lastError = "请先填写 GitHub Token 和 Gist ID"
            return
        }

        do {
            let remote = try await gistClient.pull(token: credentials.token, gistId: credentials.gistId)
            words = remote
            try cache.save(remote)
            lastSyncAt = Date()
            lastError = nil
            hasLocalReviewChanges = false
            Analytics.event(Analytics.syncPull, attributes: ["word_count": "\(remote.count)"])
        } catch {
            lastError = "同步失败：\(error.localizedDescription)"
        }
    }

    func applyReview(word: String, outcome: ReviewOutcome) -> String? {
        guard let current = words[word] else { return nil }
        let result = ReviewScheduler.apply(outcome, to: current)
        words[word] = result.word

        persistLocalReviewChanges(errorPrefix: "保存复习进度失败")
        return result.nextDueText
    }

    func deleteWord(_ word: String) {
        words.removeValue(forKey: word)
        persistLocalReviewChanges(errorPrefix: "删除单词失败")
    }

    func updateStatus(word: String, status: String) {
        guard var current = words[word] else { return }

        let previousStatus = current.status
        let now = Date()
        current.status = status
        current.lastSeen = DateCoding.localMinuteString(now)

        if status == "learning" {
            current.reviewCount = current.reviewCount ?? 0
            current.correctCount = current.correctCount ?? 0
            current.missCount = current.missCount ?? 0
            current.intervalDays = current.intervalDays ?? 0
            if previousStatus != "learning" || current.dueAt == nil {
                current.dueAt = DateCoding.isoString(now)
            }
        }

        words[word] = current
        persistLocalReviewChanges(errorPrefix: "保存状态失败")
    }

    private func persistLocalReviewChanges(errorPrefix: String) {
        do {
            try cache.save(words)
            hasLocalReviewChanges = true
            localChangeRevision += 1
            lastError = nil
            pushReviewChangesInBackground()
        } catch {
            lastError = "\(errorPrefix)：\(error.localizedDescription)"
        }
    }

    private func pushReviewChangesInBackground() {
        Task {
            await pushReviewChanges()
        }
    }

    func pushIfNeeded() async {
        guard hasLocalReviewChanges else { return }
        await pushReviewChanges()
    }

    func pushReviewChanges() async {
        if isPushingReviewChanges {
            needsPushAfterCurrentPush = true
            return
        }

        isPushingReviewChanges = true
        defer { isPushingReviewChanges = false }

        let credentials = loadCredentials()
        guard !credentials.token.isEmpty, !credentials.gistId.isEmpty else {
            lastError = "请先填写 GitHub Token 和 Gist ID"
            return
        }

        repeat {
            needsPushAfterCurrentPush = false
            guard hasLocalReviewChanges else { return }

            let revisionToPush = localChangeRevision
            let localSnapshot = words

            do {
                let remote = try await gistClient.pull(token: credentials.token, gistId: credentials.gistId)
                let merged = VocabMergeService.mergeReviewFields(local: localSnapshot, into: remote)
                try await gistClient.push(words: merged, token: credentials.token, gistId: credentials.gistId)
                lastSyncAt = Date()
                lastError = nil

                if localChangeRevision == revisionToPush {
                    words = merged
                    try cache.save(merged)
                    hasLocalReviewChanges = false
                } else {
                    hasLocalReviewChanges = true
                    needsPushAfterCurrentPush = true
                }
            } catch {
                lastError = "上传复习进度失败：\(error.localizedDescription)"
                return
            }
        } while needsPushAfterCurrentPush || hasLocalReviewChanges
    }
}
