import Foundation
import MediaPlayer
import WatchConnectivity

/// 폰이 곁에 있으면 워치는 리모컨이 된다 — 버튼을 폰으로 보내고 소리는 폰(과 폰에 연결된 헤드폰)에서
/// 난다. 폰 쪽은 `ios/Storyflow/PhoneRemote.swift`.
///
/// 폰 앱이 깔려 있으면 늘 폰으로 보낸다. 빌드 8 은 `isReachable` 을 보고 그때그때 폰/워치를 골랐는데,
/// 워치 화면이 꺼졌다 켜지는 순간처럼 잠깐 false 가 되면 조용히 워치 자체 재생으로 넘어가서, 멈췄다
/// 다시 누르면 조각 처음부터 워치 스피커로 나왔다 (2026-11-13). 이제 못 보내면 한 번 더 해 보고,
/// 그래도 안 되면 알려 주기만 한다 — 워치로 들을지는 사람이 고른다.
///
/// 워치의 모든 재생 버튼(화면, 헤드폰·"지금 재생 중" 버튼)은 `command` 하나로 모인다. 빌드 9 는
/// 헤드폰·지금 재생 중 버튼이 워치 앱의 플레이어를 직접 틀어서, 오래 멈춰 뒀다 누르면 워치 스피커와 폰
/// 헤드폰이 서로 다른 곳을 동시에 읽었다 (2026-11-13). 이제 폰 모드에서는 워치가 절대 혼자 틀지 않는다.
@MainActor
final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
    /// 폰 앱이 깔려 있어 리모컨으로 쓸 수 있는지.
    @Published private(set) var usePhone = false
    /// 마지막 명령이 폰에 닿지 못했다.
    @Published private(set) var failed = false
    /// 폰에 닿지 않을 때 사람이 "워치로 듣기"를 골랐다 — 이때만 워치가 직접 튼다.
    @Published private(set) var listenOnWatch = false
    var onPhone: Bool { usePhone && !listenOnWatch }
    private weak var narrator: Narrator?
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

    /// 워치 플레이어를 붙이고 잠금화면·헤드폰 버튼을 받는다 (한 번만).
    func attach(_ narrator: Narrator) {
        guard self.narrator == nil else { return }
        self.narrator = narrator
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.command("play") }
            return .success
        }
        commands.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.command("pause") }
            return .success
        }
        commands.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.command("toggle") }
            return .success
        }
    }

    /// 재생 버튼은 전부 여기로: 폰 모드면 폰으로, "워치로 듣기"를 골랐을 때만 워치 플레이어로.
    func command(_ cmd: String, slug: String? = nil) {
        guard let narrator else { return }
        StoryflowAPI.log("button", "\(cmd) → \(onPhone ? "phone" : "watch")")
        if onPhone {
            // 워치 플레이어가 어쩌다 틀고 있었다면 끈다 — 소리는 한 곳에서만.
            if narrator.hasQueue { narrator.stop() }
            send(cmd, readerId: narrator.readerId, lang: narrator.lang, slug: slug)
            return
        }
        switch cmd {
        case "prev": narrator.previousChunk()
        case "next": narrator.nextChunk()
        case "play": narrator.play()
        case "pause": narrator.pause()
        default: narrator.toggle()
        }
    }

    /// 폰에 닿지 않을 때 "⌚️ 워치로 듣기".
    func switchToWatch() {
        send("pause", readerId: narrator?.readerId, lang: narrator?.lang ?? "en")
        listenOnWatch = true
        narrator?.play()
    }

    /// 워치로 듣다가 "📱 폰으로 듣기".
    func switchToPhone() {
        narrator?.stop()
        listenOnWatch = false
        command("play")
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
        }, errorHandler: { error in
            Task { @MainActor in
                StoryflowAPI.log("send failed", "\(message["cmd"] ?? "") retries left \(retries): \(error)")
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
