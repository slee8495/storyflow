import Combine
import WatchConnectivity
import WebKit

/**
 워치가 리모컨일 때 폰 쪽 (2026-11-13). 워치에서 낭독을 틀면 소리가 워치 스피커로 나왔다 — 헤드폰이
 폰에 연결돼 있었기 때문이다. 그래서 폰이 곁에 있으면 워치 버튼은 이리로 오고, 폰이 직접 튼다
 (`Narrator`, 워치 앱과 같은 코드). 소리는 폰과 폰에 연결된 헤드폰·CarPlay 로 나온다.

 워치 → 폰: `["cmd": "toggle" | "play" | "pause" | "prev" | "next" | "start" | "state", "readerId", "lang", "slug"]`
 폰 → 워치: 답장과 상태가 바뀔 때마다 `Narrator.snapshot`.

 앱이 꺼져 있어도 워치가 메시지를 보내면 iOS 가 앱을 뒤에서 깨운다 — 그래서 App 의 init 에서
 바로 켠다.
 */
@MainActor
final class PhoneRemote: NSObject, WCSessionDelegate {
    static let shared = PhoneRemote()

    let narrator = Narrator(remoteCommands: false)
    /// 폰 앱의 웹 낭독 — 이쪽이 틀기 시작하면 그쪽은 멈춘다.
    weak var webView: WKWebView?
    private var observers: Set<AnyCancellable> = []

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
        // 상태가 바뀌면 워치 화면도 따라 바뀌게. 한 번에 여러 값이 바뀌므로 조금 모았다 보낸다.
        narrator.objectWillChange
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] in self?.pushState() }
            .store(in: &observers)
        narrator.$isPlaying
            .removeDuplicates()
            .filter { $0 }
            .sink { [weak self] _ in self?.stopWebPlayback() }
            .store(in: &observers)
    }

    private func handle(_ message: [String: Any]) -> [String: Any] {
        if let readerId = message["readerId"] as? Int, narrator.readerId != readerId {
            narrator.readerId = readerId
        }
        if let lang = message["lang"] as? String, !narrator.hasQueue { narrator.lang = lang }
        switch message["cmd"] as? String {
        case "toggle": narrator.toggle()
        case "play": narrator.play()
        case "pause": narrator.pause()
        case "prev": narrator.previousChunk()
        case "next": narrator.nextChunk()
        case "start":
            if let slug = message["slug"] as? String { Task { await narrator.start(slug: slug) } }
        default: break
        }
        return narrator.snapshot
    }

    private func pushState() {
        guard WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["state": narrator.snapshot], replyHandler: nil, errorHandler: nil)
    }

    private func stopWebPlayback() {
        webView?.evaluateJavaScript("window.__storyflowStopPlayback?.()")
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(
        _ session: WCSession, didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        Task { @MainActor in replyHandler(["state": self.handle(message)]) }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in _ = self.handle(message) }
    }

    nonisolated func session(
        _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?
    ) {}
    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}
    nonisolated func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
