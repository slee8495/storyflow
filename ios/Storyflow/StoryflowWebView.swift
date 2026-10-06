import SwiftUI
import UIKit
import WebKit

/**
 웹앱을 감싸는 웹뷰. wordflow/ios 의 WordflowWebView 를 옮겨 왔다.

 기본값 그대로 두면 안 되는 게 **소리**다. 낭독은 챕터를 여러 조각으로 나눠 이어 재생하는데
 (`src/lib/speak.ts`), 기본 웹뷰는 재생마다 사용자 탭을 요구해서 첫 조각만 읽고 멎는다.
 */
struct StoryflowWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = context.coordinator
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = false
        webView.load(URLRequest(url: Storyflow.homeURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKUIDelegate, WKNavigationDelegate {
        private func isInside(_ url: URL) -> Bool {
            guard let host = url.host() else { return true }
            return host.hasSuffix("storyflow-pied.vercel.app") || host.hasSuffix("vercel.app")
        }

        /// 앱 바깥 주소(그림 밑 미술관 페이지 링크 등)는 사파리로 넘긴다 — 웹뷰 안에서 열면
        /// 돌아올 길이 없는 반쪽짜리 페이지가 된다.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard
                navigationAction.navigationType == .linkActivated,
                let url = navigationAction.request.url,
                !isInside(url)
            else {
                decisionHandler(.allow)
                return
            }
            decisionHandler(.cancel)
            UIApplication.shared.open(url)
        }

        /**
         `target="_blank"` 링크. 미술관 링크가 전부 이렇다. WKWebView 는 새 창을 만들어 줄
         이 함수가 없으면 그 링크를 **조용히 무시한다** — 눌러도 아무 일이 없는 그림이 된다.
         새 창 대신 iOS 에 넘긴다.
         */
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url {
                if isInside(url) {
                    webView.load(URLRequest(url: url))
                } else {
                    UIApplication.shared.open(url)
                }
            }
            return nil
        }

        /// 웹의 `alert`·`confirm` 은 앱이 직접 띄워야 한다. 안 하면 WKWebView 가 조용히
        /// `false` 를 돌려보내서 버튼이 고장 난 것처럼 보인다 (wordflow/ios 참고).
        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            present(message: message, actions: [("확인", true)]) { _ in completionHandler() }
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            present(message: message, actions: [("취소", false), ("확인", true)]) { ok in
                completionHandler(ok)
            }
        }

        private func present(
            message: String,
            actions: [(String, Bool)],
            done: @escaping (Bool) -> Void
        ) {
            guard
                let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
            else {
                // 띄울 자리가 없으면 거절로 답한다. 답을 안 주면 웹뷰가 통째로 멈춘다.
                done(false)
                return
            }
            let sheet = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            for (label, value) in actions {
                sheet.addAction(
                    UIAlertAction(title: label, style: value ? .default : .cancel) { _ in done(value) }
                )
            }
            var top = root
            while let next = top.presentedViewController { top = next }
            top.present(sheet, animated: true)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            NSLog("[Storyflow] navigation failed: \(error.localizedDescription)")
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            NSLog("[Storyflow] load failed: \(error.localizedDescription)")
        }
    }
}
