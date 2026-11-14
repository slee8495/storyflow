import SwiftUI

@main
struct StoryflowWatchApp: App {
    @StateObject private var narrator = Narrator()

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
            // 웹앱의 인디고(--clay)와 같은 계열.
            .tint(Color(red: 0.36, green: 0.45, blue: 0.85))
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

/// 한 화면에 큰 재생/멈춤 버튼 하나 — 걸으면서도 대충 눌러도 되게.
struct NowPlayingView: View {
    @EnvironmentObject private var narrator: Narrator

    private var bookTitle: String {
        guard let book = narrator.current else { return "듣던 책이 없어요" }
        return narrator.lang == "en" ? (book.titleEn ?? book.title) : book.title
    }

    private var chapterLine: String? {
        guard let number = narrator.chapterNumber ?? narrator.current?.bookmarkChapter else { return nil }
        let prefix = narrator.lang == "ko" ? "\(number)장" : "Ch. \(number)"
        guard let title = narrator.chapterTitle else { return prefix }
        return "\(prefix) · \(title)"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text(bookTitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if let chapterLine {
                    Text(chapterLine)
                        .font(.footnote.weight(.semibold))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }

                Button(action: narrator.toggle) {
                    ZStack {
                        Circle().fill(Color(red: 0.36, green: 0.45, blue: 0.85))
                        if narrator.isLoading {
                            ProgressView()
                        } else {
                            Image(systemName: narrator.isPlaying ? "pause.fill" : "play.fill")
                                .font(.system(size: 44, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                    .frame(width: 110, height: 110)
                }
                .buttonStyle(.plain)
                .disabled(narrator.current == nil)
                .accessibilityLabel(narrator.isPlaying ? "멈춤" : "재생")

                if let error = narrator.errorText {
                    Text(error).font(.caption2).foregroundStyle(.orange).multilineTextAlignment(.center)
                }

                HStack {
                    NavigationLink {
                        BookListView()
                    } label: {
                        Label("책", systemImage: "books.vertical")
                    }
                    Button {
                        narrator.skipChapter()
                    } label: {
                        Label("다음 장", systemImage: "forward.end.fill")
                    }
                    .disabled(narrator.chapterNumber == nil)
                }
                .labelStyle(.iconOnly)
                .font(.title3)
            }
        }
        .task {
            await narrator.loadLibrary()
            #if DEBUG
            // 시뮬레이터 확인용: `-autoplay` 로 띄우면 바로 이어 듣기를 시작한다.
            if ProcessInfo.processInfo.arguments.contains("-autoplay") { narrator.play() }
            #endif
        }
    }
}

struct BookListView: View {
    @EnvironmentObject private var narrator: Narrator
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section("읽는 중") {
                ForEach(narrator.readingBooks) { book in
                    Button {
                        narrator.start(book)
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
