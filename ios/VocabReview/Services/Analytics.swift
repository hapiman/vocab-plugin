import UMCommon

/// 轻量埋点封装，统一管理事件 ID
enum Analytics {

    // MARK: - 事件 ID

    static let appOpen = "app_open"
    static let reviewStart = "review_start"
    static let reviewComplete = "review_complete"
    static let reviewSessionEnd = "review_session_end"
    static let wordDetailView = "word_detail_view"
    static let syncPull = "sync_pull"

    // MARK: - 上报

    static func event(_ eventId: String) {
        MobClick.event(eventId)
    }

    static func event(_ eventId: String, attributes: [String: String]) {
        MobClick.event(eventId, attributes: attributes)
    }
}
