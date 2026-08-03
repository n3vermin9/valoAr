import UIKit
import ObjectiveC

/// Hides the iOS form accessory bar (↑↓ / Done) in WKWebView by swizzling
/// `inputAccessoryView` — same approach as Capacitor's Keyboard plugin.
enum KeyboardAccessoryHider {
  private static var didSwizzle = false
  private static var retryCount = 0

  static func install() {
    attemptSwizzle()

    // WebKit classes may load after the first Capacitor bridge paint.
    if !didSwizzle {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { attemptSwizzle() }
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { attemptSwizzle() }
      DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { attemptSwizzle() }
    }
  }

  private static func attemptSwizzle() {
    if didSwizzle { return }

    // Built in parts so the private class names aren't stripped.
    let wkName = ["WK", "Content", "View"].joined()
    let uiName = ["UI", "Web", "Browser", "View"].joined()
    let selector = NSSelectorFromString("inputAccessoryView")

    var swizzledAny = false
    for name in [wkName, uiName] {
      guard let cls: AnyClass = NSClassFromString(name) else { continue }
      guard let method = class_getInstanceMethod(cls, selector) else { continue }

      let block: @convention(block) (AnyObject) -> AnyObject? = { _ in nil }
      method_setImplementation(method, imp_implementationWithBlock(block))
      swizzledAny = true
    }

    if swizzledAny {
      didSwizzle = true
      return
    }

    retryCount += 1
    if retryCount < 20 {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { attemptSwizzle() }
    }
  }
}
