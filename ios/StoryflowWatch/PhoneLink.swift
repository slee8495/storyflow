import Foundation
import WatchConnectivity

/// 폰이 곁에 있으면 워치는 리모컨이 된다 — 버튼을 폰으로 보내고 소리는 폰(과 폰에 연결된 헤드폰)에서
/// 난다. 폰 쪽은 `ios/Storyflow/PhoneRemote.swift`.
///
/// 폰 앱이 깔려 있으면 늘 폰으로 보낸다. 빌드 8 은 `isReachable` 을 보고 그때그때 폰/워치를 골랐는데,
/// 워치 화면이 꺼졌다 켜지는 순간처럼 잠깐 false 가 되면 조용히 워치 자체 재생으로 넘어가서, 멈췄다
/// 다시 누르면 조각 처음부터 워치 스피커로 나왔다 (2026-11-13). 이제 못 보내면 한 번 더 해 보고,
/// 그래도 안 되면 알려 주기만 한다 — 워치로 들을지는 사람이 고른다.
@MainActor
final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
    /// 폰 앱이 깔려 있어 리모컨으로 쓸 수 있는지.
    @Published private(set) var usePhone = false
    /// 마지막 명령이 폰에 닿지 못했다.
    @Published private(set) var failed = false
    /// 폰이 보내 준 지금 상태 (`Narrator.snapshot`).
    @Published private(set) var state: [String: Any] = [:]

    var isPlaying: Bool { state["playing"] as? Bool ?? false }
    var isLoading: Bool { state["loading"] as? Bool ?? false }
    var book: String? { state["book"] as? String }
    var chapter: Int? { state["chapter"] as? Int }
    var chapterTitle: String? { state["chapterTitle"] as? String }
    var error: String? { failed ? "폰에 닿지 않아요" : state["error"] as? String }

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
        deliver(message, retries: 2)
    }

    /// 손목을 들자마자 누르면 연결이 아직 덜 붙어 있을 때가 있다 — 조금 기다렸다 다시 보낸다.
    private func deliver(_ message: [String: Any], retries: Int) {
        WCSession.default.sendMessage(message, replyHandler: { reply in
            Task { @MainActor in
                self.failed = false
                if let state = reply["state"] as? [String: Any] { self.state = state }
            }
        }, errorHandler: { _ in
            Task { @MainActor in
                guard retries > 0 else {
                    self.failed = true
                    return
                }
                try? await Task.sleep(for: .seconds(1))
                self.deliver(message, retries: retries - 1)
            }
        })
    }

    private func refresh() {
        WCSession.default.sendMessage(["cmd": "state"], replyHandler: { reply in
            Task { @MainActor in
                self.failed = false
                if let state = reply["state"] as? [String: Any] { self.state = state }
            }
        }, errorHandler: nil)
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(
        _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?
    ) {
        let installed = activationState == .activated && session.isCompanionAppInstalled
        Task { @MainActor in
            self.usePhone = installed
            if installed { self.refresh() }
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        guard session.isReachable else { return }
        Task { @MainActor in self.refresh() }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let state = message["state"] as? [String: Any] else { return }
        Task { @MainActor in
            self.failed = false
            self.state = state
        }
    }
}
