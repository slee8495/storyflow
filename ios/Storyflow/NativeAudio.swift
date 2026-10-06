import AVFoundation
import MediaPlayer
import WebKit

/**
 챕터 낭독을 웹뷰의 `<audio>` 대신 앱이 직접 재생한다 (`src/lib/nativeAudio.ts` 가 짝이다).

 웹뷰 `<audio>` 는 소리 데이터를 웹 프로세스가 조금씩 넘겨준다. 앱이 뒤로 가 있는 CarPlay
 운전 중에는 그 프로세스가 느려져서 공급이 밀리고, 소리가 지지직·뚝뚝 버벅였다 (폰 화면을 켜고
 들을 땐 멀쩡). 여기서는 웹앱이 다 만든 WAV 를 한 번에 넘겨받아 메모리에 들고 AVAudioPlayer 로
 튼다 — 재생 중에는 웹뷰가 아무 일도 안 해도 된다.

 웹 → 앱 (`storyflowAudio` 메시지): begin · data(b64) · play(title) · pause · resume · stop
 앱 → 웹 (`window.__storyflowNativeAudio(event, value)`): playing · pause · time(초) · ended · error
 */
final class NativeAudio: NSObject, WKScriptMessageHandler, AVAudioPlayerDelegate {
    static let handlerName = "storyflowAudio"

    weak var webView: WKWebView?
    private var player: AVAudioPlayer?
    private var pending = Data()
    private var title = "Storyflow"
    private var ticker: Timer?
    private var resumeAfterInterruption = false

    override init() {
        super.init()
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.addTarget { [weak self] _ in
            self?.resume()
            return .success
        }
        commands.pauseCommand.addTarget { [weak self] _ in
            self?.pause()
            return .success
        }
        commands.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self, let player = self.player else { return .noActionableNowPlayingItem }
            player.isPlaying ? self.pause() : self.resume()
            return .success
        }
        let center = NotificationCenter.default
        center.addObserver(
            self, selector: #selector(interrupted(_:)),
            name: AVAudioSession.interruptionNotification, object: nil)
        center.addObserver(
            self, selector: #selector(routeChanged(_:)),
            name: AVAudioSession.routeChangeNotification, object: nil)
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "begin":
            stop()
            pending = Data()
        case "data":
            if let b64 = body["b64"] as? String, let chunk = Data(base64Encoded: b64) {
                pending.append(chunk)
            }
        case "play":
            title = body["title"] as? String ?? "Storyflow"
            start()
        case "pause":
            pause()
        case "resume":
            resume()
        case "stop":
            stop()
        default:
            break
        }
    }

    private func start() {
        do {
            let player = try AVAudioPlayer(data: pending)
            pending = Data()
            player.delegate = self
            self.player = player
            try AVAudioSession.sharedInstance().setActive(true)
            player.play()
            didStartPlaying()
        } catch {
            NSLog("[Storyflow] native audio: \(error.localizedDescription)")
            pending = Data()
            emit("error")
        }
    }

    private func pause() {
        guard let player, player.isPlaying else { return }
        player.pause()
        ticker?.invalidate()
        updateNowPlaying()
        emit("pause")
    }

    private func resume() {
        guard let player else {
            emit("error")
            return
        }
        try? AVAudioSession.sharedInstance().setActive(true)
        if player.play() {
            didStartPlaying()
        } else {
            emit("error")
        }
    }

    private func stop() {
        ticker?.invalidate()
        guard let player else { return }
        player.stop()
        self.player = nil
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        // 듣던 음악·팟캐스트가 있었다면 다시 이어지게 한다.
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func didStartPlaying() {
        updateNowPlaying()
        emit("playing")
        ticker?.invalidate()
        // 문장 하이라이트용. 웹뷰가 느려져 있어도 소리는 상관없다 — 늦게 받을 뿐이다.
        ticker = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            guard let self, let player = self.player else { return }
            self.emit("time", player.currentTime)
        }
    }

    private func updateNowPlaying() {
        guard let player else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: "Storyflow",
            MPMediaItemPropertyPlaybackDuration: player.duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: player.isPlaying ? 1.0 : 0.0,
        ]
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        emit("time", player.duration)
        stop()
        emit(flag ? "ended" : "error")
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        stop()
        emit("error")
    }

    /// 전화·Siri·지도 길안내가 끼어들면 멈췄다가, 끝나고 iOS 가 이어도 된다고 하면 이어 튼다.
    @objc private func interrupted(_ note: Notification) {
        guard
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: raw)
        else { return }
        DispatchQueue.main.async { [self] in
            switch type {
            case .began:
                resumeAfterInterruption = player?.isPlaying ?? false
                ticker?.invalidate()
                if resumeAfterInterruption { emit("pause") }
            case .ended:
                let options = (note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt)
                    .map(AVAudioSession.InterruptionOptions.init(rawValue:)) ?? []
                if resumeAfterInterruption && options.contains(.shouldResume) { resume() }
                resumeAfterInterruption = false
            @unknown default:
                break
            }
        }
    }

    /// 차에서 내려 CarPlay 가 끊기면 폰 스피커로 계속 떠들지 않게 멈춘다.
    @objc private func routeChanged(_ note: Notification) {
        guard
            let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
            AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable
        else { return }
        DispatchQueue.main.async { [self] in pause() }
    }

    private func emit(_ event: String, _ value: Double? = nil) {
        let arg = value.map { String($0) } ?? "undefined"
        webView?.evaluateJavaScript("window.__storyflowNativeAudio?.('\(event)', \(arg))")
    }
}
