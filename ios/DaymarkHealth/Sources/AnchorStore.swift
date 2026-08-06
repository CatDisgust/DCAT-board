import Foundation
import HealthKit

enum AnchorStore {
    private static let prefix = "daymark.healthkit.anchor."

    static func load(for key: String) -> HKQueryAnchor? {
        guard let data = UserDefaults.standard.data(forKey: prefix + key) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
    }

    static func save(_ anchors: [String: HKQueryAnchor]) {
        for (key, anchor) in anchors {
            if let data = try? NSKeyedArchiver.archivedData(
                withRootObject: anchor,
                requiringSecureCoding: true
            ) {
                UserDefaults.standard.set(data, forKey: prefix + key)
            }
        }
    }
}
