import Foundation

/// 웹앱(storyflow-pied.vercel.app)의 API 를 그대로 쓴다. 워치 앱은 화면만 다르고 데이터·이어 듣기
/// 위치·낭독 음성(`/api/speak` 가 Blob 에 캐시한 mp3)은 폰·패드·컴퓨터와 같은 것을 쓴다.
enum StoryflowAPI {
    static let base = URL(string: "https://storyflow-pied.vercel.app")!

    struct Reader: Decodable, Identifiable, Hashable {
        let id: Int
        let name: String
    }

    struct Book: Decodable, Identifiable, Hashable {
        let id: Int
        let slug: String
        let title: String
        let titleEn: String?
        let bookmarkChapter: Int?
        let lastReadAt: String?
        let finishedOn: String?
        let archivedAt: String?
        let readyChapters: Int
        let progressPct: Double?
    }

    struct Chapter: Decodable {
        struct BookRef: Decodable {
            let id: Int
            let slug: String
            let title: String
        }
        struct Content: Decodable {
            let chapterNumber: Int
            let titleKo: String?
            let titleEn: String?
            let storyKo: String?
            let storyEn: String?
        }
        struct Resume: Decodable {
            let chunkIndex: Int
            let lang: String
        }
        let book: BookRef
        let chapter: Content
        let nextReady: Bool?
        let resume: Resume?

        func story(_ lang: String) -> String? { lang == "en" ? chapter.storyEn : chapter.storyKo }
        func title(_ lang: String) -> String? { lang == "en" ? chapter.titleEn : chapter.titleKo }
    }

    private static func get<T: Decodable>(_ path: String, _ query: [String: String] = [:]) async throws -> T {
        var components = URLComponents(url: base.appending(path: path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) } }
        let (data, response) = try await URLSession.shared.data(from: components.url!)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(T.self, from: data)
    }

    static func readers() async throws -> [Reader] {
        struct Response: Decodable { let readers: [Reader] }
        let response: Response = try await get("api/reader")
        return response.readers
    }

    static func books(readerId: Int) async throws -> [Book] {
        struct Response: Decodable { let books: [Book] }
        let response: Response = try await get("api/books", ["readerId": String(readerId)])
        return response.books
    }

    static func chapter(slug: String, number: Int, readerId: Int) async throws -> Chapter {
        try await get("api/books/\(slug)/chapters/\(number)", ["readerId": String(readerId)])
    }

    /// 이어 듣기 위치 저장 — 웹의 `src/lib/chapterTrack.ts` 와 같은 요청.
    static func saveBookmark(readerId: Int, bookId: Int, chapterNumber: Int, chunkIndex: Int, lang: String) {
        var request = URLRequest(url: base.appending(path: "api/bookmarks"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "readerId": readerId, "bookId": bookId, "chapterNumber": chapterNumber,
            "chunkIndex": chunkIndex, "lang": lang,
        ])
        URLSession.shared.dataTask(with: request).resume()
    }

    /// 한 조각의 낭독 mp3. 웹과 글자 하나까지 같은 문장을 보내야 서버 캐시(Blob)를 같이 쓴다.
    static func speechURL(_ text: String) -> URL {
        // `+` 를 그대로 두면 서버가 공백으로 읽는다 — 영숫자와 -._~ 말고는 전부 인코딩한다.
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        let encoded = text.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
        return URL(string: "\(base.absoluteString)/api/speak?text=\(encoded)&v=aoede")!
    }
}
