import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    /**
     웹앱을 실제로 띄운 적이 있는가. 배경 오디오 중 화면 없이 깨어나는 경우에 웹앱 전체를
     불러오지 않기 위한 문이다 (wordflow/ios 참고). 한 번 앞에 나온 뒤로는 계속 둔다 —
     치우면 다시 열 때 읽던 자리와 재생 중이던 낭독이 날아간다.
     */
    @State private var everActive = false

    var body: some View {
        Group {
            if everActive {
                StoryflowWebView()
                    .ignoresSafeArea(.container, edges: .bottom)
            } else {
                // 웹뷰가 뜨기 전 흰 화면이 번쩍이지 않도록 웹앱의 종이색(globals.css --paper)을 깐다.
                Color(red: 0.969, green: 0.961, blue: 0.941)
                    .ignoresSafeArea()
            }
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            if phase == .active { everActive = true }
        }
    }
}
