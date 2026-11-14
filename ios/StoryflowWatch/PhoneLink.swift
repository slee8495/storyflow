import Foundation
import WatchConnectivity

/// 폰이 곁에 있으면 워치는 리모컨이 된다 — 버튼을 폰으로 보내고 소리는 폰(과 폰에 연결된 헤드폰)에서
/// 난다. 폰 쪽은 `ios/Storyflow/PhoneRemote.swift`. 폰이 멀리 있으면 워치가 직접 튼다 (Narrator).
@MainActor
final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
    @Published private(set) var reachable = false
    /// 폰이 보내 준 지금 상태 (`Narrator.snapshot`).
    @Published private(set) var state: [String: Any] = [:]

    var isPlaying: Bool { state["playing"] as? Bool ?? false }
    var isLoading: Bool { state["loading"] as? Bool ?? false }
    var book: String? { state["book"] as? String }
    var chapter: Int? { state["chapter"] as? Int }
    var chapterTitle: String? { state["chapterTitle"] as? String }
    var error: String? { state["error"] as? String }

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func send(_ cmd: String, readerId: Int?, lang: String, slug: String? = nil) {
        var message: [String: Any] = ["cmd": cmd, "lang": lang]
        if let readerId { message["readerId"] = readerId }
        if let slug { message["slug"] = slug }
        WCSession.default.sendMessage(message, replyHandler: { reply in
            Task { @MainActor in
                if let state = reply["state"] as? [String: Any] { self.state = state }
            }
        }, errorHandler: { _ in
            Task { @MainActor in self.reachable = WCSession.default.isReachable }
        })
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(
        _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?
    ) {
        let reachable = session.isReachable
        Task { @MainActor in
            self.reachable = reachable
            if reachable { self.refresh() }
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        Task { @MainActor in
            self.reachable = reachable
            if reachable { self.refresh() }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let state = message["state"] as? [String: Any] else { return }
        Task { @MainActor in self.state = state }
    }

    private func refresh() {
        WCSession.default.sendMessage(["cmd": "state"], replyHandler: { reply in
            Task { @MainActor in
                if let state = reply["state"] as? [String: Any] { self.state = state }
            }
        }, errorHandler: nil)
    }
}
