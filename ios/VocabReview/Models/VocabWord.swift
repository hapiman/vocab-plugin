import Foundation

typealias VocabMap = [String: VocabWord]

struct VocabWord: Codable, Equatable {
    var status: String?
    var firstSeen: String?
    var lastSeen: String?
    var contexts: [VocabContext]?
    var definition: String?
    var phonetic: String?
    var reviewCount: Int?
    var correctCount: Int?
    var missCount: Int?
    var intervalDays: Int?
    var dueAt: String?
    var lastReviewed: String?
    var additionalFields: [String: JSONValue] = [:]

    var isLearning: Bool {
        status == "learning"
    }

    var latestSentence: String {
        contexts?.last?.sentence ?? ""
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case status
        case firstSeen
        case lastSeen
        case contexts
        case definition
        case phonetic
        case reviewCount
        case correctCount
        case missCount
        case intervalDays
        case dueAt
        case lastReviewed
    }

    init(
        status: String? = nil,
        firstSeen: String? = nil,
        lastSeen: String? = nil,
        contexts: [VocabContext]? = nil,
        definition: String? = nil,
        phonetic: String? = nil,
        reviewCount: Int? = nil,
        correctCount: Int? = nil,
        missCount: Int? = nil,
        intervalDays: Int? = nil,
        dueAt: String? = nil,
        lastReviewed: String? = nil,
        additionalFields: [String: JSONValue] = [:]
    ) {
        self.status = status
        self.firstSeen = firstSeen
        self.lastSeen = lastSeen
        self.contexts = contexts
        self.definition = definition
        self.phonetic = phonetic
        self.reviewCount = reviewCount
        self.correctCount = correctCount
        self.missCount = missCount
        self.intervalDays = intervalDays
        self.dueAt = dueAt
        self.lastReviewed = lastReviewed
        self.additionalFields = additionalFields
    }

    init(from decoder: Decoder) throws {
        let known = try decoder.container(keyedBy: CodingKeys.self)
        status = try known.decodeIfPresent(String.self, forKey: .status)
        firstSeen = try known.decodeIfPresent(String.self, forKey: .firstSeen)
        lastSeen = try known.decodeIfPresent(String.self, forKey: .lastSeen)
        contexts = try known.decodeIfPresent([VocabContext].self, forKey: .contexts)
        definition = try known.decodeIfPresent(String.self, forKey: .definition)
        phonetic = try known.decodeIfPresent(String.self, forKey: .phonetic)
        reviewCount = try known.decodeIfPresent(Int.self, forKey: .reviewCount)
        correctCount = try known.decodeIfPresent(Int.self, forKey: .correctCount)
        missCount = try known.decodeIfPresent(Int.self, forKey: .missCount)
        intervalDays = try known.decodeIfPresent(Int.self, forKey: .intervalDays)
        dueAt = try known.decodeIfPresent(String.self, forKey: .dueAt)
        lastReviewed = try known.decodeIfPresent(String.self, forKey: .lastReviewed)

        let dynamic = try decoder.container(keyedBy: DynamicCodingKey.self)
        let knownKeys = Set(CodingKeys.allCases.map(\.rawValue))
        additionalFields = [:]

        for key in dynamic.allKeys where !knownKeys.contains(key.stringValue) {
            additionalFields[key.stringValue] = try dynamic.decode(JSONValue.self, forKey: key)
        }
    }

    func encode(to encoder: Encoder) throws {
        var dynamic = encoder.container(keyedBy: DynamicCodingKey.self)
        for (key, value) in additionalFields {
            try dynamic.encode(value, forKey: DynamicCodingKey(stringValue: key))
        }

        var known = encoder.container(keyedBy: CodingKeys.self)
        try known.encodeIfPresent(status, forKey: .status)
        try known.encodeIfPresent(firstSeen, forKey: .firstSeen)
        try known.encodeIfPresent(lastSeen, forKey: .lastSeen)
        try known.encodeIfPresent(contexts, forKey: .contexts)
        try known.encodeIfPresent(definition, forKey: .definition)
        try known.encodeIfPresent(phonetic, forKey: .phonetic)
        try known.encodeIfPresent(reviewCount, forKey: .reviewCount)
        try known.encodeIfPresent(correctCount, forKey: .correctCount)
        try known.encodeIfPresent(missCount, forKey: .missCount)
        try known.encodeIfPresent(intervalDays, forKey: .intervalDays)
        try known.encodeIfPresent(dueAt, forKey: .dueAt)
        try known.encodeIfPresent(lastReviewed, forKey: .lastReviewed)
    }
}

struct DynamicCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int?

    init(stringValue: String) {
        self.stringValue = stringValue
    }

    init(intValue: Int) {
        self.stringValue = String(intValue)
        self.intValue = intValue
    }
}
