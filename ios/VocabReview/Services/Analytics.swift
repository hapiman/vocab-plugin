import UMCommon

/// Lightweight analytics wrapper with centralized event IDs
enum Analytics {

    // MARK: - Event IDs

    static let appOpen = "app_open"
    static let reviewStart = "review_start"
    static let reviewComplete = "review_complete"
    static let reviewSessionEnd = "review_session_end"
    static let wordDetailView = "word_detail_view"
    static let syncPull = "sync_pull"

    // MARK: - Reporting

    static func event(_ eventId: String) {
        MobClick.event(eventId)
    }

    static func event(_ eventId: String, attributes: [String: String]) {
        MobClick.event(eventId, attributes: attributes)
    }
}
