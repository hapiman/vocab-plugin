import UIKit
import UMCommon

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // 友盟统计初始化（替换为你的 AppKey）
        UMConfigure.initWithAppkey("6a06a6999a7f376488df0ed8", channel: "App Store")
        #if DEBUG
        UMConfigure.setLogEnabled(true)
        #endif

        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        Task {
            await VocabStore.shared.pushIfNeeded()
        }
    }
}
