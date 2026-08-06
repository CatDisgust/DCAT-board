import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        HealthKitService.shared.configureBackgroundDelivery {
            await SyncCoordinator.shared.sync(days: 7)
        }
        return true
    }
}
