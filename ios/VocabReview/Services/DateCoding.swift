import Foundation

enum DateCoding {
    private static let isoWithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let localMinuteFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter
    }()

    static func parseDue(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        if let date = isoWithFractional.date(from: value) {
            return date
        }
        if let date = isoPlain.date(from: value) {
            return date
        }
        return localMinuteFormatter.date(from: value)
    }

    static func isoString(_ date: Date) -> String {
        isoWithFractional.string(from: date)
    }

    static func localMinuteString(_ date: Date) -> String {
        localMinuteFormatter.string(from: date)
    }
}
