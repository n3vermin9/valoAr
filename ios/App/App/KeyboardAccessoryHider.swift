import UIKit
import WebKit
import ObjectiveC
import Capacitor

/// Hides the WKWebView form accessory bar (↑↓ / Done).
/// Capacitor Keyboard's one-shot swizzle often runs before WKContentView exists
/// and then never retries — this patches instances and retries until it sticks.
enum KeyboardAccessoryHider {
  private static var observersInstalled = false
  private static var didLogReady = false

  static func install() {
    apply()
    installObserversIfNeeded()

    // Bridge / WKContentView appear after first paint.
    for delay in [0.15, 0.5, 1.0, 2.0] as [TimeInterval] {
      DispatchQueue.main.asyncAfter(deadline: .now() + delay) { apply() }
    }
  }

  private static func installObserversIfNeeded() {
    guard !observersInstalled else { return }
    observersInstalled = true

    let nc = NotificationCenter.default
    nc.addObserver(forName: UIResponder.keyboardWillShowNotification, object: nil, queue: .main) { _ in
      apply()
    }
    nc.addObserver(forName: UIResponder.keyboardDidShowNotification, object: nil, queue: .main) { _ in
      apply()
      // One more pass after the accessory is attached.
      DispatchQueue.main.async { apply() }
    }
  }

  private static func apply() {
    swizzleKnownClasses()
    patchWebViewsInHierarchy()
  }

  /// Same idea as Capacitor Keyboard, but safe when classes are still nil.
  private static func swizzleKnownClasses() {
    let names = [
      ["WK", "Content", "View"].joined(),
      ["UI", "Web", "Browser", "View"].joined(),
    ]
    let selector = NSSelectorFromString("inputAccessoryView")

    for name in names {
      guard let cls: AnyClass = NSClassFromString(name) else { continue }
      guard let method = class_getInstanceMethod(cls, selector) else { continue }

      let block: @convention(block) (AnyObject) -> AnyObject? = { _ in nil }
      let imp = imp_implementationWithBlock(block)

      if !class_addMethod(cls, selector, imp, method_getTypeEncoding(method)) {
        method_setImplementation(method, imp)
      }
    }
  }

  private static func patchWebViewsInHierarchy() {
    var roots: [UIView] = []
    for scene in UIApplication.shared.connectedScenes {
      guard let windowScene = scene as? UIWindowScene else { continue }
      roots.append(contentsOf: windowScene.windows)
    }

    if let bridgeVC = findBridgeViewController() {
      if let webView = bridgeVC.webView {
        patch(webView: webView)
      }
      if let view = bridgeVC.view {
        roots.append(view)
      }
    }

    for root in roots {
      for webView in findWKWebViews(in: root) {
        patch(webView: webView)
      }
      if let content = findWKContentView(in: root) {
        patch(contentView: content)
        if !didLogReady {
          didLogReady = true
          NSLog("KeyboardAccessoryHider: patched %@", NSStringFromClass(type(of: content)))
        }
      }
    }
  }

  private static func findBridgeViewController() -> CAPBridgeViewController? {
    for scene in UIApplication.shared.connectedScenes {
      guard let windowScene = scene as? UIWindowScene else { continue }
      for window in windowScene.windows {
        if let bridge = window.rootViewController as? CAPBridgeViewController {
          return bridge
        }
        if let bridge = window.rootViewController?.children.compactMap({ $0 as? CAPBridgeViewController }).first {
          return bridge
        }
      }
    }
    return nil
  }

  private static func patch(webView: WKWebView) {
    for sub in webView.scrollView.subviews {
      let name = NSStringFromClass(type(of: sub))
      if name.contains("WKContent") {
        patch(contentView: sub)
      }
    }
  }

  /// Runtime subclass so this instance's `inputAccessoryView` is always nil.
  private static func patch(contentView: UIView) {
    let current = type(of: contentView)
    let currentName = NSStringFromClass(current)
    if currentName.contains("_NoInputAccessoryView") { return }

    let subclassName = currentName + "_NoInputAccessoryView"
    var newClass: AnyClass? = NSClassFromString(subclassName)

    if newClass == nil {
      guard let allocated: AnyClass = objc_allocateClassPair(current, subclassName, 0) else { return }
      let selector = NSSelectorFromString("inputAccessoryView")
      let block: @convention(block) (AnyObject) -> AnyObject? = { _ in nil }
      let imp = imp_implementationWithBlock(block)
      var encoding = ("@@:" as NSString).utf8String
      if let method = class_getInstanceMethod(current, selector)
        ?? class_getInstanceMethod(UIView.self, selector)
      {
        encoding = method_getTypeEncoding(method) ?? encoding
      }
      class_addMethod(allocated, selector, imp, encoding)
      objc_registerClassPair(allocated)
      newClass = allocated
    }

    if let newClass {
      object_setClass(contentView, newClass)
    }
  }

  private static func findWKWebViews(in root: UIView) -> [WKWebView] {
    var found: [WKWebView] = []
    if let web = root as? WKWebView { found.append(web) }
    for sub in root.subviews {
      found.append(contentsOf: findWKWebViews(in: sub))
    }
    return found
  }

  private static func findWKContentView(in root: UIView) -> UIView? {
    let name = NSStringFromClass(type(of: root))
    if name.contains("WKContent") { return root }
    for sub in root.subviews {
      if let hit = findWKContentView(in: sub) { return hit }
    }
    return nil
  }
}
