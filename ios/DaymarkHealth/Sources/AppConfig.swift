import Foundation

struct AppConfig {
    static let shared = AppConfig()

    let supabaseURL: URL?
    let supabaseKey: String

    var isConfigured: Bool {
        guard let supabaseURL else { return false }
        return supabaseURL.host != "example.supabase.co"
            && !supabaseKey.isEmpty
            && supabaseKey != "replace-me"
    }

    private init(bundle: Bundle = .main) {
        let urlString = bundle.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        supabaseURL = URL(string: urlString)
        supabaseKey = bundle.object(forInfoDictionaryKey: "SUPABASE_PUBLISHABLE_KEY") as? String ?? ""
    }
}
