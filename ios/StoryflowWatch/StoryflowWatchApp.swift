import SwiftUI

/// 웹앱의 인디고(--clay)와 같은 계열.
private let accent = Color(red: 0.36, green: 0.45, blue: 0.85)

@main
struct StoryflowWatchApp: App {
    // 잠금화면·헤드폰 버튼은 PhoneLink.attach 가 받는다 (폰 모드면 폰으로 보내야 하므로).
    @StateObject private var narrator = Narrator(remoteCommands: false)
    @StateObject private var phone = PhoneLink()

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                if narrator.readerId == nil {
                    ReaderPickView()
                } else {
                    NowPlayingView()
                }
            }
            .environmentObject(narrator)
            .environmentObject(phone)
            .tint(accent)
            .task { phone.attach(narrator) }
        }
    }
}

/// 첫 실행에 한 번: 웹앱에서 쓰는 이름을 고른다 (워치에서 이름을 치는 건 너무 번거롭다).
struct ReaderPickView: View {
    @EnvironmentObject private var narrator: Narrator
    @State private var readers: [StoryflowAPI.Reader] = []
    @State private var failed = false

    var body: some View {
        List {
            Section("누구세요?") {
                ForEach(readers) { reader in
                    Button(reader.name) { narrator.readerId = reader.id }
                }
                if failed { Text("목록을 못 불러왔어요").foregroundStyle(.secondary) }
            }
        }
        .navigationTitle("Storyflow")
        .task {
            do { readers = try await StoryflowAPI.readers() } catch { failed = true }
        }
    }
}

/// 가운데 큰 재생/멈춤, 양옆에 한 조각(몇 문장) 뒤로·앞으로. 챕터를 통째로 넘기는 버튼은 없다 —
/// 잘못 누르면 챕터가 넘어가 버려서 오히려 불편했다 (2026-11-13).
///
/// 폰이 곁에 있으면 버튼은 폰으로 가고 소리는 폰에서 난다. 폰이 없으면 워치가 직접 튼다.
struct NowPlayingView: View {
    @EnvironmentObject private var narrator: Narrator
    @EnvironmentObject private var phone: PhoneLink

    private var onPhone: Bool { phone.onPhone }
    private var isPlaying: Bool { onPhone ? phone.isPlaying : narrator.isPlaying }
    private var isLoading: Bool { onPhone ? phone.isLoading : narrator.isLoading }
    private var error: String? { onPhone ? phone.error : narrator.errorText }

    private var bookTitle: String {
        if onPhone, let book = phone.book { return book }
        guard let book = narrator.current else { return "듣던 책이 없어요" }
        return narrator.lang == "en" ? (book.titleEn ?? book.title) : book.title
    }

    private var chapterLine: String? {
        let number = onPhone ? phone.chapter : (narrator.chapterNumber ?? narrator.current?.bookmarkChapter)
        guard let number else { return nil }
        let prefix = narrator.lang == "ko" ? "\(number)장" : "Ch. \(number)"
        guard let title = onPhone ? phone.chapterTitle : narrator.chapterTitle else { return prefix }
        return "\(prefix) · \(title)"
    }

    private func command(_ cmd: String) { phone.command(cmd) }

    var body: some View {
        VStack(spacing: 6) {
            Text(onPhone ? "📱 \(bookTitle)" : bookTitle)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            if let chapterLine {
                Text(chapterLine)
                    .font(.footnote.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }

            HStack(spacing: 6) {
                Button { command("prev") } label: {
                    Image(systemName: "backward.fill").font(.title3)
                }
                .accessibilityLabel("한 조각 뒤로")

                Button { command("toggle") } label: {
                    ZStack {
                        Circle().fill(accent)
                        if isLoading {
                            ProgressView()
                        } else {
                            Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                                .font(.system(size: 38, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                    .frame(width: 90, height: 90)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isPlaying ? "멈춤" : "재생")

                Button { command("next") } label: {
                    Image(systemName: "forward.fill").font(.title3)
                }
                .accessibilityLabel("한 조각 앞으로")
            }

            if let error {
                Text(error).font(.caption2).foregroundStyle(.orange).multilineTextAlignment(.center)
            }
            if onPhone && phone.failed {
                Button("⌚️ 워치로 듣기") { phone.switchToWatch() }
                    .font(.caption2)
            } else if phone.listenOnWatch && phone.usePhone {
                Button("📱 폰으로 듣기") { phone.switchToPhone() }
                    .font(.caption2)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                NavigationLink {
                    BookListView()
                } label: {
                    Image(systemName: "books.vertical")
                }
                .accessibilityLabel("책")
            }
        }
        .task {
            await narrator.loadLibrary()
            #if DEBUG
            // 시뮬레이터 확인용: `-autoplay` 로 띄우면 바로 이어 듣기를 시작한다 (폰이 곁에 있으면 폰에서).
            if ProcessInfo.processInfo.arguments.contains("-autoplay") {
                try? await Task.sleep(for: .seconds(3))
                command("toggle")
                // `-pauseResume`: 멈췄다 다시 틀기 (빌드 8 에서 워치 스피커로 넘어가던 경우).
                if ProcessInfo.processInfo.arguments.contains("-pauseResume") {
                    try? await Task.sleep(for: .seconds(12))
                    command("toggle")
                    try? await Task.sleep(for: .seconds(4))
                    command("toggle")
                }
            }
            #endif
        }
    }
}

struct BookListView: View {
    @EnvironmentObject private var narrator: Narrator
    @EnvironmentObject private var phone: PhoneLink
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section("읽는 중") {
                ForEach(narrator.readingBooks) { book in
                    Button {
                        if phone.onPhone {
                            phone.command("start", slug: book.slug)
                        } else {
                            narrator.start(book)
                        }
                        dismiss()
                    } label: {
                        VStack(alignment: .leading) {
                            Text(narrator.lang == "en" ? (book.titleEn ?? book.title) : book.title).lineLimit(2)
                            if let chapter = book.bookmarkChapter {
                                Text(narrator.lang == "ko" ? "\(chapter)장부터" : "from Ch. \(chapter)")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            Section("듣는 언어") {
                Picker("언어", selection: $narrator.lang) {
                    Text("한국어").tag("ko")
                    Text("English").tag("en")
                }
            }
            Section {
                Button("사용자 바꾸기") {
                    narrator.pause()
                    narrator.readerId = nil
                }
                .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("책")
        .task { await narrator.loadLibrary() }
    }
}
