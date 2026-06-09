import Foundation

struct LocalCache {
    private let fileManager: FileManager
    private let fileName = "vocab-learner.json"

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    func load() throws -> VocabMap {
        let url = try cacheURL()
        guard fileManager.fileExists(atPath: url.path) else { return [:] }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(VocabMap.self, from: data)
    }

    func save(_ words: VocabMap) throws {
        let url = try cacheURL()
        let data = try makeEncoder().encode(words)
        try data.write(to: url, options: [.atomic])
    }

    private func cacheURL() throws -> URL {
        let directory = try fileManager.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return directory.appendingPathComponent(fileName)
    }

    private func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}
