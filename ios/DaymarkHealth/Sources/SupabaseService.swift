import Foundation
import Combine
import Supabase
import UIKit

@MainActor
final class SupabaseService: ObservableObject {
    static let shared = SupabaseService()

    @Published private(set) var session: Session?
    @Published private(set) var isSendingLink = false
    @Published var authMessage: String?

    let client: SupabaseClient?

    private init() {
        let config = AppConfig.shared
        if let url = config.supabaseURL, config.isConfigured {
            client = SupabaseClient(supabaseURL: url, supabaseKey: config.supabaseKey)
        } else {
            client = nil
        }
    }

    func restoreSession() async {
        guard let client else { return }
        session = try? await client.auth.session
    }

    func sendMagicLink(email: String) async {
        guard let client else {
            authMessage = "请先配置 Supabase。"
            return
        }
        isSendingLink = true
        defer { isSendingLink = false }
        do {
            try await client.auth.signInWithOTP(
                email: email,
                redirectTo: URL(string: "daymark://auth-callback")
            )
            authMessage = "登录链接已发送。请务必在安装了 Daymark Health 的这台 iPhone 上打开邮件。"
        } catch {
            authMessage = error.localizedDescription
        }
    }

    func handleOpenURL(_ url: URL) async {
        guard let client else { return }
        do {
            session = try await client.auth.session(from: url)
            authMessage = nil
        } catch {
            authMessage = "登录链接无效或已过期。"
        }
    }

    func signOut() async {
        guard let client else { return }
        try? await client.auth.signOut()
        session = nil
    }

    func profileTimezone() async -> TimeZone {
        guard let client else { return TimeZone(identifier: "Australia/Sydney")! }
        do {
            let row: ProfileTimezone = try await client
                .from("profiles")
                .select("timezone")
                .single()
                .execute()
                .value
            return TimeZone(identifier: row.timezone) ?? TimeZone(identifier: "Australia/Sydney")!
        } catch {
            return TimeZone(identifier: "Australia/Sydney")!
        }
    }

    func ingest(_ batch: HealthSyncBatch) async throws {
        guard let client else { throw SyncError.notConfigured }
        let params = IngestHealthParams(
            samples: batch.samples,
            deletedIdentifiers: batch.deletedIdentifiers,
            deviceID: DeviceIdentity.id,
            deviceName: UIDevice.current.name,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "2.0.0",
            permissions: [
                "sleep_requested": true,
                "body_mass_requested": true,
                "body_fat_requested": true,
                "active_energy_requested": true,
            ]
        )
        try await client.rpc("ingest_health_samples", params: params).execute()
    }
}

enum DeviceIdentity {
    private static let key = "daymark.device.id"

    static var id: String {
        if let value = UserDefaults.standard.string(forKey: key) { return value }
        let value = UUID().uuidString
        UserDefaults.standard.set(value, forKey: key)
        return value
    }
}

enum SyncError: LocalizedError {
    case notConfigured
    case notSignedIn
    case healthDataUnavailable

    var errorDescription: String? {
        switch self {
        case .notConfigured: "Supabase 尚未配置。"
        case .notSignedIn: "请先登录同一个 Daymark 账户。"
        case .healthDataUnavailable: "这台设备无法使用 Apple Health。"
        }
    }
}
