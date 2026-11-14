import AVFoundation
import Combine
import MediaPlayer
import SwiftUI

/// 낭독을 앱이 직접 튼다 — 워치 앱과, 워치가 리모컨일 때의 아이폰 앱이 같이 쓴다.
///
/// 폰 앱·웹은 한 챕터를 WAV 하나로 이어 붙여 틀지만, 이 플레이어는 조각(~200자)마다 서버의 mp3 를
/// AVQueuePlayer 에 줄 세워 틀고, 조각이 바뀔 때마다 이어 듣기 위치를 저장한다. 챕터 끝이
/// 가까워지면 다음 챕터(번역된 것만)를 "82장. 제목." 한 줄과 함께 줄 뒤에 붙여서 끊김 없이 넘어간다.
/// 조각 단위로 앞뒤로 옮길 수 있다 (워치의 ◀︎ ▶︎).
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
    /// 지금 들리는 조각.
    private var playingClip: Clip?
    /// 줄 맨 뒤에 붙어 있는 챕터 — 다음 챕터는 이 뒤에 붙인다.
    private var lastQueued: StoryflowAPI.Chapter?
    private var appendingNext = false
    private var observers: Set<AnyCancellable> = []
    private var sessionActive = false
    /// 사용자가 마지막으로 누른 게 재생인지 — 줄이 다 끝난 뒤 다음 챕터가 붙으면 이걸 보고 다시 튼다.
    private var wantsToPlay = false

    /// 줄에 뭔가 걸려 있는지 (멈춰 있어도). 폰 앱이 잠금화면 버튼을 어느 플레이어로 보낼지 정할 때 쓴다.
    var hasQueue: Bool { player.currentItem != nil }

    /// `remoteCommands`: 잠금화면·이어폰 버튼을 이 플레이어가 직접 받을지. 폰 앱은 NativeAudio 가
    /// 이미 받아서 이쪽으로 넘겨 주므로 false.
    init(remoteCommands: Bool) {
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
                if status == .playing { self.didStartPlaying() }
                let reason = self.player.reasonForWaitingToPlay?.rawValue ?? ""
                StoryflowAPI.log("status", "\(status == .playing ? "playing" : status == .paused ? "paused" : "waiting") \(reason)")
            }
            .store(in: &observers)
        NotificationCenter.default.publisher(for: AVPlayerItem.failedToPlayToEndTimeNotification)
            .sink { note in
                let error = note.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
                StoryflowAPI.log("item failed", error.map { "\($0)" } ?? "")
            }
            .store(in: &observers)
        NotificationCenter.default.publisher(for: AVAudioSession.routeChangeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] note in self?.routeChanged(note) }
            .store(in: &observers)
        guard remoteCommands else { return }
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.play() }
            return .success
        }
        commands.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.pause() }
            return .success
        }
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

    // MARK: - 버튼

    func toggle() {
        if isPlaying { pause() } else { play() }
    }

    func play() {
        StoryflowAPI.log("play", hasQueue ? "resume" : "start from bookmark")
        wantsToPlay = true
        if player.currentItem != nil {
            Task {
                if await activateSession() { player.play() }
            }
        } else {
            Task {
                // 폰 앱이 워치 버튼으로 처음 깨어났을 때는 서재부터 불러야 듣던 책을 안다.
                if current == nil { await loadLibrary() }
                if let current { start(current) }
            }
        }
    }

    func pause() {
        StoryflowAPI.log("pause")
        wantsToPlay = false
        player.pause()
    }

    /// 다른 플레이어(폰 앱의 웹 낭독)가 소리를 넘겨받았을 때.
    func stop() {
        StoryflowAPI.log("stop", hasQueue ? "had a queue" : "")
        wantsToPlay = false
        stopQueue()
        chapterNumber = nil
        chapterTitle = nil
    }

    /// 한 조각 뒤로 — 지금 조각의 처음이 아니라 바로 앞 조각부터 다시.
    func previousChunk() {
        guard let clip = playingClip else { return }
        restart(clip.chapter, at: max((clip.chunkIndex ?? 0) - 1, 0))
    }

    /// 한 조각 앞으로.
    func nextChunk() {
        guard player.items().count > 1 else { return }
        player.advanceToNextItem()
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

    /// 같은 책을 slug 로 (워치가 폰에 "이 책 틀어"라고 보낼 때).
    func start(slug: String) async {
        if !books.contains(where: { $0.slug == slug }) { await loadLibrary() }
        if let book = books.first(where: { $0.slug == slug }) { start(book) }
    }

    private func restart(_ chapter: StoryflowAPI.Chapter, at index: Int) {
        let resume = wantsToPlay || isPlaying
        stopQueue()
        guard enqueue(chapter, from: index, intro: false) else { return }
        wantsToPlay = resume
        if resume { player.play() }
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
        lastQueued = chapter
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
        playingClip = nil
        lastQueued = nil
    }

    private func itemChanged(_ item: AVPlayerItem?) {
        guard let item, let clip = clips[ObjectIdentifier(item)] else {
            // 줄이 다 끝났다 (다음 챕터가 없거나 아직 번역 전).
            if item == nil { isPlaying = false }
            return
        }
        playingClip = clip
        chapterNumber = clip.chapter.chapter.chapterNumber
        chapterTitle = clip.chapter.title(lang)
        updateNowPlaying()
        if let index = clip.chunkIndex, let readerId {
            StoryflowAPI.saveBookmark(
                readerId: readerId, bookId: clip.chapter.book.id,
                chapterNumber: clip.chapter.chapter.chapterNumber, chunkIndex: index, lang: lang)
        }
        // 마지막 챕터의 남은 조각이 몇 개 안 남으면 다음 챕터를 미리 붙인다.
        if let last = lastQueued, last.chapter.chapterNumber == clip.chapter.chapter.chapterNumber,
           player.items().count <= 4 {
            appendNextChapter(after: last)
        }
    }

    private func appendNextChapter(after chapter: StoryflowAPI.Chapter) {
        guard !appendingNext, chapter.nextReady == true, let readerId else { return }
        appendingNext = true
        Task {
            defer { appendingNext = false }
            guard let next = try? await StoryflowAPI.chapter(
                slug: chapter.book.slug, number: chapter.chapter.chapterNumber + 1, readerId: readerId),
                lastQueued?.chapter.chapterNumber == chapter.chapter.chapterNumber
            else { return }
            enqueue(next, from: 0, intro: true)
            // 이미 줄이 다 끝나 멈춰 있었다면 다시 튼다.
            if wantsToPlay { player.play() }
        }
    }

    // MARK: - 오디오 세션 · 잠금화면

    private func activateSession() async -> Bool {
        let session = AVAudioSession.sharedInstance()
        #if os(watchOS)
        if sessionActive { return true }
        // 워치는 긴 오디오를 블루투스 헤드폰으로 튼다 — 워치에 연결된 게 없으면 워치가 고르는 화면을
        // 띄운다. 켜지지 않으면 틀지 않는다 (그대로 틀면 워치 스피커로 나온다).
        do {
            try session.setCategory(.playback, mode: .default, policy: .longFormAudio, options: [])
        } catch {
            errorText = "오디오를 켤 수 없어요"
            return false
        }
        let ok = await withCheckedContinuation { continuation in
            session.activate(options: []) { ok, _ in continuation.resume(returning: ok) }
        }
        StoryflowAPI.log("session", ok ? "activated" : "activation failed")
        #else
        // 폰은 매번 다시 켠다 — 멈춘 채 뒤에 오래 있던 뒤(워치가 깨운 경우)에도 확실히 소리가 나게.
        var ok = true
        do {
            try session.setCategory(.playback, mode: .spokenAudio)
            try session.setActive(true)
            StoryflowAPI.log("session", "activated")
        } catch {
            // 오래 멈춰 있다 워치가 앱을 뒤에서 깨우면, iOS 가 뒤에 있는 앱이 소리를 새로 켜는 걸 막을 수
            // 있다. 다른 소리와 섞일 수 있는(mixWithOthers) 세션은 뒤에서도 켜지므로 그걸로 틀고, 소리가
            // 나기 시작하면 원래대로 되돌린다 (didStartPlaying).
            StoryflowAPI.log("session", "activation failed: \(error)")
            do {
                try session.setCategory(.playback, mode: .spokenAudio, options: [.mixWithOthers])
                try session.setActive(true)
                startedMixable = true
                StoryflowAPI.log("session", "activated as mixable")
            } catch {
                StoryflowAPI.log("session", "mixable activation failed: \(error)")
                ok = false
            }
        }
        #endif
        sessionActive = ok
        if !ok {
            wantsToPlay = false
            #if os(watchOS)
            errorText = "블루투스 헤드폰을 연결해 주세요"
            #else
            errorText = "폰에서 소리를 켤 수 없어요"
            #endif
        }
        return ok
    }

    /// 뒤에서 켜느라 섞이는 세션으로 시작했다면, 소리가 나기 시작한 뒤 평소 세션(잠금화면 컨트롤이
    /// 뜨는)으로 돌린다.
    private var startedMixable = false
    private func didStartPlaying() {
        #if os(iOS)
        guard startedMixable else { return }
        startedMixable = false
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
            StoryflowAPI.log("session", "back to non-mixable")
        } catch {
            StoryflowAPI.log("session", "un-mix failed: \(error)")
        }
        #endif
    }

    /// 헤드폰이 끊기면 (배터리, 벗어서 케이스에 넣음) 멈춘다 — 다시 누르면 세션부터 다시 켠다.
    private func routeChanged(_ note: Notification) {
        guard
            let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
            AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable,
            hasQueue
        else { return }
        pause()
        sessionActive = false
    }

    private func updateNowPlaying() {
        guard hasQueue, let current, let chapterNumber else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: chapterTitle.map { "\(chapterNumber). \($0)" } ?? "Ch. \(chapterNumber)",
            MPMediaItemPropertyArtist: lang == "en" ? (current.titleEn ?? current.title) : current.title,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        ]
    }

    // MARK: - 워치 ↔ 폰

    /// 워치 화면에 보여 줄 상태 (WatchConnectivity 메시지로 오간다).
    var snapshot: [String: Any] {
        var state: [String: Any] = ["playing": isPlaying, "loading": isLoading, "lang": lang]
        if let current { state["book"] = lang == "en" ? (current.titleEn ?? current.title) : current.title }
        if let chapterNumber { state["chapter"] = chapterNumber }
        if let chapterTitle { state["chapterTitle"] = chapterTitle }
        if let errorText { state["error"] = errorText }
        return state
    }
}
