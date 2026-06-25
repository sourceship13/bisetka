import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash
import Firebase

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "bisetka",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  private func sanitizedMetroHost(_ rawValue: String) -> String {
    let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      return ""
    }

    if let parsedURL = URL(string: trimmed), let parsedHost = parsedURL.host {
      return parsedHost
    }

    return trimmed
      .replacingOccurrences(of: "http://", with: "")
      .replacingOccurrences(of: "https://", with: "")
      .components(separatedBy: "/")
      .first?
      .components(separatedBy: ":")
      .first ?? trimmed
  }

  private func metroBundleURL() -> URL? {
#if DEBUG
    #if targetEnvironment(simulator)
      let host = "127.0.0.1"
    #else
      let rawHost = (Bundle.main.object(forInfoDictionaryKey: "MetroHost") as? String) ?? ""
      let host = sanitizedMetroHost(rawHost)
    #endif

    guard !host.isEmpty else {
      return URL(string: "http://127.0.0.1:8081/index.bundle?platform=ios&dev=true&minify=false")
    }

    return URL(string: "http://\(host):8081/index.bundle?platform=ios&dev=true&minify=false")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    metroBundleURL()
  }

  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }

  override func bundleURL() -> URL? {
    metroBundleURL()
  }
}
