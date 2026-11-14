import AVFoundation
import Combine
import MediaPlayer
import SwiftUI

/// 워치에서 직접 낭독을 튼다 — 폰이 없어도 (워치 LTE·와이파이 + 에어팟) 된다.
///
/// 폰 앱·웹은 한 챕터를 WAV 하나로 이어 붙여 틀지만 워치에서 그 렌더링은 너무 무겁다. 여기서는
/// 조각(~200자)마다 서버의 mp3 를 AVQueuePlayer 에 줄 세워 틀고, 조각이 바뀔 때마다 이어 듣기
/// 위치를 저장한다. 챕터 끝이 가까워지면 다음 챕터(번역된 것만)를 "82장. 제목." 한 줄과 함께
/// 줄 뒤에 붙여서 끊김 없이 넘어간다.
@MainActor
final class Narrator: ObservableObject {
    @Published var readerId: Int? = UserDefaults.standard.object(forKey: "readerId") as? Int {
        didSet { UserDefaults.standard.set(readerId, forKey: "readerId") }
    }
    @Published private(set) var books: [StoryflowAPI.Book] = []
    @Published private(set) var current: StoryflowAPI.Book?
    @Published private(set) var chapterNumber: Int?
    @Published private(set) var chapterTitle: String?
    @Published private(set) var isPlaying = false
    @Published private(set) var isLoading = false
    @Published var errorText: String?
    /// 처음엔 웹에서 마지막으로 듣던 언어(이어 듣기 위치에 같이 저장됨)를 따른다.
    @Published var lang: String = UserDefaults.standard.string(forKey: "lang") ?? "en" {
        didSet { UserDefaults.standard.set(lang, forKey: "lang") }
    }

    private struct Clip {
        let chapter: StoryflowAPI.Chapter
        /// nil 이면 챕터 첫머리의 "82장." 안내.
        let chunkIndex: Int?
    }

    private let player = AVQueuePlayer()
    private var clips: [ObjectIdentifier: Clip] = [:]
    /// 줄 맨 뒤에 붙어 있는 챕터 — 다음 챕터는 이 뒤에 붙인다.
    private var lastQueued: (chapter: StoryflowAPI.Chapter, remaining: Int)?
    private var appendingNext = false
    private var observers: Set<AnyCancellable> = []
    private var sessionActive = false
    /// 사용자가 마지막으로 누른 게 재생인지 — 줄이 다 끝난 뒤 다음 챕터가 붙으면 이걸 보고 다시 튼다.
    private var wantsToPlay = false

    init() {
        player.actionAtItemEnd = .advance
        player.publisher(for: \.currentItem)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] item in self?.itemChanged(item) }
            .store(in: &observers)
        player.publisher(for: \.timeControlStatus)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                guard let self else { return }
                self.isPlaying = status != .paused
                self.updateNowPlaying()
            }
            .store(in: &observers)
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.play() }
            return .success
        }
        commands.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.pause() }
            return .success
        }
        NotificationCenter.default.publisher(for: AVAudioSession.routeChangeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] note in self?.routeChanged(note) }
            .store(in: &observers)
        commands.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.toggle() }
            return .success
        }
    }

    // MARK: - 서재

    /// 듣던 책 = 다 읽거나 보관하지 않은 책 중 가장 최근에 읽은 것.
    var readingBooks: [StoryflowAPI.Book] {
        books
            .filter { $0.finishedOn == nil && $0.archivedAt == nil && $0.readyChapters > 0 }
            .sorted { ($0.lastReadAt ?? "") > ($1.lastReadAt ?? "") }
    }

    func loadLibrary() async {
        guard let readerId else { return }
        do {
            books = try await StoryflowAPI.books(readerId: readerId)
            if current == nil || player.currentItem == nil { current = readingBooks.first }
            errorText = nil
        } catch {
            errorText = "서재를 못 불러왔어요"
        }
    }

    // MARK: - 재생 버튼

    func toggle() {
        if isPlaying { pause() } else { play() }
    }

    func play() {
        wantsToPlay = true
        if player.currentItem != nil {
            Task {
                if await activateSession() { player.play() }
            }
        } else if let current {
            start(current)
        }
    }

    func pause() {
        wantsToPlay = false
        player.pause()
    }

    /// 책의 이어 듣기 위치(챕터 + 문장)부터 튼다.
    func start(_ book: StoryflowAPI.Book) {
        guard let readerId else { return }
        current = book
        stopQueue()
        wantsToPlay = true
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                let chapter = try await StoryflowAPI.chapter(
                    slug: book.slug, number: book.bookmarkChapter ?? 1, readerId: readerId)
                if let resume = chapter.resume { lang = resume.lang }
                guard enqueue(chapter, from: chapter.resume?.chunkIndex ?? 0, intro: false) else {
                    errorText = "이 챕터는 아직 번역 중이에요"
                    return
                }
                errorText = nil
                if await activateSession() { player.play() }
            } catch {
                errorText = "챕터를 못 불러왔어요"
            }
        }
    }

    /// 지금 챕터를 건너뛰고 다음 챕터로.
    func skipChapter() {
        guard let readerId, let current, let chapterNumber else { return }
        let book = current
        stopQueue()
        wantsToPlay = true
        isLoading = true
        Task {
            defer { isLoading = false }
            guard let next = try? await StoryflowAPI.chapter(
                slug: book.slug, number: chapterNumber + 1, readerId: readerId),
                enqueue(next, from: 0, intro: true)
            else {
                errorText = "다음 챕터가 아직 없어요"
                return
            }
            if await activateSession() { player.play() }
        }
    }

    // MARK: - 줄 세우기

    @discardableResult
    private func enqueue(_ chapter: StoryflowAPI.Chapter, from start: Int, intro: Bool) -> Bool {
        guard let story = chapter.story(lang) else { return false }
        let chunks = SpeechChunks.split(story)
        guard !chunks.isEmpty else { return false }
        let from = min(max(start, 0), chunks.count - 1)
        if intro {
            let line = SpeechChunks.intro(
                chapterNumber: chapter.chapter.chapterNumber, title: chapter.title(lang), lang: lang)
            add(StoryflowAPI.speechURL(line), Clip(chapter: chapter, chunkIndex: nil))
        }
        for index in from..<chunks.count {
            let text = SpeechChunks.stripVerseMarkers(chunks[index])
            add(StoryflowAPI.speechURL(text), Clip(chapter: chapter, chunkIndex: index))
        }
        lastQueued = (chapter, chunks.count - from)
        return true
    }

    private func add(_ url: URL, _ clip: Clip) {
        let item = AVPlayerItem(url: url)
        clips[ObjectIdentifier(item)] = clip
        player.insert(item, after: nil)
    }

    private func stopQueue() {
        player.pause()
        player.removeAllItems()
        clips.removeAll()
        lastQueued = nil
    }

    private func itemChanged(_ item: AVPlayerItem?) {
        guard let item, let clip = clips[ObjectIdentifier(item)] else {
            // 줄이 다 끝났다 (다음 챕터가 없거나 아직 번역 전).
            if item == nil { isPlaying = false }
            return
        }
        chapterNumber = clip.chapter.chapter.chapterNumber
        chapterTitle = clip.chapter.title(lang)
        updateNowPlaying()
        if let index = clip.chunkIndex, let readerId {
            StoryflowAPI.saveBookmark(
                readerId: readerId, bookId: clip.chapter.book.id,
                chapterNumber: clip.chapter.chapter.chapterNumber, chunkIndex: index, lang: lang)
        }
        // 마지막 챕터의 남은 조각이 몇 개 안 남으면 다음 챕터를 미리 붙인다.
        if let last = lastQueued, last.chapter.chapter.chapterNumber == clip.chapter.chapter.chapterNumber {
            let left = player.items().count
            if left <= 4 { appendNextChapter(after: last.chapter) }
        }
    }

    private func appendNextChapter(after chapter: StoryflowAPI.Chapter) {
        guard !appendingNext, chapter.nextReady == true, let readerId else { return }
        appendingNext = true
        Task {
            defer { appendingNext = false }
            guard let next = try? await StoryflowAPI.chapter(
                slug: chapter.book.slug, number: chapter.chapter.chapterNumber + 1, readerId: readerId),
                lastQueued?.chapter.chapter.chapterNumber == chapter.chapter.chapterNumber
            else { return }
            enqueue(next, from: 0, intro: true)
            // 이미 줄이 다 끝나 멈춰 있었다면 다시 튼다.
            if wantsToPlay { player.play() }
        }
    }

    // MARK: - 오디오 세션 · 잠금화면

    /// 워치는 긴 오디오를 블루투스 이어폰·헤드폰으로만 튼다 — 연결이 안 돼 있으면 워치가 기기를
    /// 고르는 화면을 띄운다. 세션이 켜지지 않으면 틀지 않는다: 그대로 틀면 워치 스피커로 나온다
    /// (2026-11-13 실제 워치에서 그랬다 — 그때는 mode 를 .spokenAudio 로 줬고, 실패해도 그냥 틀었다).
    /// 애플 예제대로 mode 는 .default.
    private func activateSession() async -> Bool {
        if sessionActive { return true }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, policy: .longFormAudio, options: [])
        } catch {
            errorText = "오디오를 켤 수 없어요"
            return false
        }
        let ok = await withCheckedContinuation { continuation in
            session.activate(options: []) { ok, _ in continuation.resume(returning: ok) }
        }
        sessionActive = ok
        if !ok {
            wantsToPlay = false
            errorText = "블루투스 헤드폰을 연결해 주세요"
        }
        return ok
    }

    /// 헤드폰이 끊기면 (배터리, 벗어서 케이스에 넣음) 멈춘다 — 다시 누르면 세션부터 다시 켠다.
    private func routeChanged(_ note: Notification) {
        guard
            let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
            AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable
        else { return }
        pause()
        sessionActive = false
    }

    private func updateNowPlaying() {
        guard let current, let chapterNumber else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: chapterTitle.map { "\(chapterNumber). \($0)" } ?? "Ch. \(chapterNumber)",
            MPMediaItemPropertyArtist: lang == "en" ? (current.titleEn ?? current.title) : current.title,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        ]
    }
}
