import UIKit
import WebKit
import Capacitor

/// Custom bridge — simulator uses a non-persistent WK data store to avoid iOS 18.4+
/// WKWebView networking regressions that surface as Firebase auth/network-request-failed.
/// Also pushes UIKit safe-area insets into CSS (env() is often 0 in Capacitor WKWebView).
final class AppBridgeViewController: CAPBridgeViewController {
  private var lastInjectedInsets = UIEdgeInsets(top: -1, left: -1, bottom: -1, right: -1)

  override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
    let configuration = super.webViewConfiguration(for: instanceConfiguration)

    #if targetEnvironment(simulator)
    if #available(iOS 18.3, *) {
      configuration.websiteDataStore = .nonPersistent()
    }
    #endif

    // Run before first paint so --ios-safe-* is non-zero even when CSS env() is 0.
    let script = WKUserScript(
      source: Self.safeAreaJavaScript(for: Self.resolvedInsets(from: nil)),
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    configuration.userContentController.addUserScript(script)

    return configuration
  }

    override public func capacitorDidLoad() {
    super.capacitorDidLoad()
    injectSafeAreaCSSVariables()
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    injectSafeAreaCSSVariables()
  }

  override func viewSafeAreaInsetsDidChange() {
    super.viewSafeAreaInsetsDidChange()
    injectSafeAreaCSSVariables()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    injectSafeAreaCSSVariables()
    // Live-reload / first paint can race insets — refresh after the document settles.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
      self?.injectSafeAreaCSSVariables(force: true)
    }
  }

  private func injectSafeAreaCSSVariables(force: Bool = false) {
    let insets = Self.resolvedInsets(from: view?.safeAreaInsets)
    if !force, insets == lastInjectedInsets { return }
    lastInjectedInsets = insets
    webView?.evaluateJavaScript(Self.safeAreaJavaScript(for: insets), completionHandler: nil)
  }

  private static func resolvedInsets(from viewInsets: UIEdgeInsets?) -> UIEdgeInsets {
    var insets = viewInsets ?? .zero
    if insets.top < 1 {
      insets.top = estimatedTopInset()
    }
    if insets.bottom < 1 {
      insets.bottom = estimatedBottomInset()
    }
    return insets
  }

  private static func estimatedTopInset() -> CGFloat {
    if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
       let statusHeight = scene.statusBarManager?.statusBarFrame.height,
       statusHeight > 0 {
      return statusHeight
    }
    let tallest = max(UIScreen.main.bounds.height, UIScreen.main.bounds.width)
    if tallest >= 852 { return 59 }
    if tallest >= 812 { return 50 }
    return 20
  }

  private static func estimatedBottomInset() -> CGFloat {
    let tallest = max(UIScreen.main.bounds.height, UIScreen.main.bounds.width)
    return tallest >= 812 ? 34 : 0
  }

  private static func safeAreaJavaScript(for insets: UIEdgeInsets) -> String {
    let top = String(format: "%.2f", insets.top)
    let right = String(format: "%.2f", insets.right)
    let bottom = String(format: "%.2f", insets.bottom)
    let left = String(format: "%.2f", insets.left)
    return """
    (function () {
      var r = document.documentElement;
      if (!r || !r.style) return;
      r.style.setProperty('--native-safe-top', '\(top)px');
      r.style.setProperty('--native-safe-right', '\(right)px');
      r.style.setProperty('--native-safe-bottom', '\(bottom)px');
      r.style.setProperty('--native-safe-left', '\(left)px');
    })();
    """
  }
}
