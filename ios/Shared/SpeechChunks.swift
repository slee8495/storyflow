import Foundation

/// `src/lib/speak.ts` 의 splitIntoChunks · stripVerseMarkers 를 그대로 옮긴 것.
/// 조각 경계가 웹과 똑같아야 (1) 이어 듣기 위치(chunkIndex)가 기기끼리 맞고 (2) 서버에 이미 만들어
/// 둔 낭독 mp3 를 다시 만들지 않고 쓴다. 웹 쪽을 고치면 여기도 같이 고친다.
enum SpeechChunks {
    static let maxChunkLength = 200

    private static let sentence = try! NSRegularExpression(pattern: "[^.!?]+[.!?]+[\"'‘’“”]*|[^.!?]+$")
    private static let verseMarker = try! NSRegularExpression(pattern: "\\(\\d+\\)\\s*")

    static func split(_ text: String) -> [String] {
        let ns = text as NSString
        let matches = sentence.matches(in: text, range: NSRange(location: 0, length: ns.length))
        let sentences = matches.isEmpty ? [text] : matches.map { ns.substring(with: $0.range) }
        var chunks: [String] = []
        var buf = ""
        // 웹은 JS 문자열 길이(UTF-16)로 잰다 — 똑같이 잰다.
        for s in sentences {
            if !buf.isEmpty && buf.utf16.count + s.utf16.count > maxChunkLength {
                chunks.append(trim(buf))
                buf = s
            } else {
                buf += s
            }
        }
        if !trim(buf).isEmpty { chunks.append(trim(buf)) }
        return chunks
    }

    static func stripVerseMarkers(_ text: String) -> String {
        let ns = text as NSString
        return verseMarker.stringByReplacingMatches(in: text, range: NSRange(location: 0, length: ns.length), withTemplate: "")
    }

    private static func trim(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// 다음 챕터로 넘어갈 때 먼저 말하는 한 줄 — 웹의 chapterIntro 와 같은 문장 (캐시도 같이 쓴다).
    static func intro(chapterNumber: Int, title: String?, lang: String) -> String {
        let number = lang == "ko" ? "\(chapterNumber)장." : "Chapter \(chapterNumber)."
        if let title, !title.isEmpty { return "\(number) \(title)." }
        return number
    }
}
