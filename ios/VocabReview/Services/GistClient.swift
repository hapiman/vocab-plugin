import Foundation

struct GistClient {
    private let session: URLSession
    private let fileName = "vocab-learner.json"

    init(session: URLSession = .shared) {
        self.session = session
    }

    static func normalizedGistId(from rawValue: String) -> String {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        if let components = URLComponents(string: trimmed), components.scheme != nil {
            let pathParts = components.path
                .split(separator: "/")
                .map(String.init)
                .filter { !$0.isEmpty }

            if let hexId = pathParts.first(where: { part in
                part.range(of: #"^[A-Fa-f0-9]{20,64}$"#, options: .regularExpression) != nil
            }) {
                return hexId
            }

            return pathParts.last ?? ""
        }

        return trimmed
            .split(separator: "?")
            .first
            .map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? trimmed
    }

    func pull(token: String, gistId: String) async throws -> VocabMap {
        var request = URLRequest(url: try gistURL(gistId: gistId))
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)

        let gist = try JSONDecoder().decode(GistResponse.self, from: data)
        guard let content = gist.files[fileName]?.content else {
            return [:]
        }
        guard let contentData = content.data(using: .utf8) else {
            return [:]
        }
        return try JSONDecoder().decode(VocabMap.self, from: contentData)
    }

    func push(words: VocabMap, token: String, gistId: String) async throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let encodedWords = try encoder.encode(words)
        guard let content = String(data: encodedWords, encoding: .utf8) else {
            throw GistClientError.invalidContent
        }

        var request = URLRequest(url: try gistURL(gistId: gistId))
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(GistUpdateRequest(files: [
            fileName: GistUpdateFile(content: content)
        ]))

        let (responseData, response) = try await session.data(for: request)
        try validate(response: response, data: responseData)
    }

    private func gistURL(gistId: String) throws -> URL {
        let normalizedId = Self.normalizedGistId(from: gistId)
        guard !normalizedId.isEmpty else {
            throw GistClientError.missingGistId
        }

        var components = URLComponents()
        components.scheme = "https"
        components.host = "api.github.com"
        components.path = "/gists/\(normalizedId)"

        guard let url = components.url else {
            throw GistClientError.invalidURL(normalizedId)
        }
        return url
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw GistClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = GitHubErrorMessage.parse(from: data)
            throw GistClientError.httpStatus(http.statusCode, message)
        }
    }
}

private enum GitHubErrorMessage {
    static func parse(from data: Data) -> String {
        if let response = try? JSONDecoder().decode(GitHubErrorResponse.self, from: data),
           let message = response.message,
           !message.isEmpty {
            return message
        }

        return String(data: data, encoding: .utf8) ?? ""
    }
}

private struct GistResponse: Decodable {
    var files: [String: GistFile]
}

private struct GitHubErrorResponse: Decodable {
    var message: String?
}

private struct GistFile: Decodable {
    var content: String?
}

private struct GistUpdateRequest: Encodable {
    var files: [String: GistUpdateFile]
}

private struct GistUpdateFile: Encodable {
    var content: String
}

enum GistClientError: LocalizedError {
    case missingGistId
    case invalidURL(String)
    case invalidResponse
    case invalidContent
    case httpStatus(Int, String)

    var errorDescription: String? {
        switch self {
        case .missingGistId:
            return "Enter a Gist ID or full Gist URL."
        case .invalidURL(let gistId):
            return "Invalid Gist ID format: \(gistId)"
        case .invalidResponse:
            return "GitHub returned an invalid response."
        case .invalidContent:
            return "Failed to encode vocabulary JSON."
        case .httpStatus(let statusCode, let message):
            return httpMessage(statusCode: statusCode, message: message)
        }
    }

    private func httpMessage(statusCode: Int, message: String) -> String {
        let detail = message.isEmpty ? "" : ": \(message)"

        switch statusCode {
        case 401:
            return "GitHub token is invalid or expired\(detail)"
        case 403:
            return "GitHub denied access. Ensure your token has gist permission\(detail)"
        case 404:
            return "Gist not found. Check that the Gist ID is correct and the token can access the secret Gist\(detail)"
        default:
            return "GitHub API returned error \(statusCode)\(detail)"
        }
    }
}
