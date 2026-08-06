import Foundation
import Combine

@MainActor
final class SyncCoordinator: ObservableObject {
    static let shared = SyncCoordinator()

    enum State: Equatable {
        case idle
        case requestingPermission
        case syncing
        case success(Date)
        case failed(String)
    }

    @Published private(set) var state: State = .idle
    @Published private(set) var permissionRequested =
        UserDefaults.standard.bool(forKey: "daymark.health.permission.requested")

    private let health = HealthKitService.shared
    private let supabase = SupabaseService.shared

    private init() {}

    func authorizeAndSync() async {
        state = .requestingPermission
        do {
            try await health.requestAuthorization()
            permissionRequested = true
            await sync(days: 30)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func sync(days: Int = 30) async {
        guard supabase.session != nil else {
            state = .failed(SyncError.notSignedIn.localizedDescription)
            return
        }
        state = .syncing
        do {
            let timezone = await supabase.profileTimezone()
            let batch = try await health.makeSyncBatch(days: days, timezone: timezone)
            try await supabase.ingest(batch)
            AnchorStore.save(batch.anchors)
            let now = Date()
            UserDefaults.standard.set(now, forKey: "daymark.health.last.sync")
            state = .success(now)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    var lastSync: Date? {
        if case let .success(date) = state { return date }
        return UserDefaults.standard.object(forKey: "daymark.health.last.sync") as? Date
    }
}
