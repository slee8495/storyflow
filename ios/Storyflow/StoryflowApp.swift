import AVFoundation
import SwiftUI

/**
 Storyflow — 아이폰에 사는 껍데기. wordflow/ios 와 같은 구조다.

 화면은 웹앱이 이미 전부 갖고 있다. 이 앱이 있는 이유는 **소리와 자리**다:

 1. 챕터 낭독을 켜 두고 화면을 끄면 웹앱(PWA)은 멎는다. 네이티브 껍데기여야 백그라운드
    오디오가 붙고 잠금 화면에 재생 컨트롤이 뜬다.
 2. 홈 화면 PWA 는 iOS 가 저장소를 심심하면 날려서 이름 로그인이 풀린다.
 3. TestFlight 로 링크 하나에 깔린다.
 */
@main
struct StoryflowApp: App {
    init() {
        /*
          낭독이 잠금 화면 뒤에서도 이어지게 하는 자리. 기본 카테고리는 화면이 꺼지면 소리를
          끊는다. `setActive(true)` 는 부르지 않는다 — 앱을 여는 순간 듣던 음악을 끊지 않도록.
          실제로 소리를 낼 때 웹뷰가 알아서 켠다.
        */
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        } catch {
            NSLog("[Storyflow] audio session: \(error.localizedDescription)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

enum Storyflow {
    static let homeURL = URL(string: "https://storyflow-pied.vercel.app")!
}
