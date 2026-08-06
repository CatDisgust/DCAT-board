import SwiftUI

@main
struct DaymarkHealthApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var supabase = SupabaseService.shared
    @StateObject private var sync = SyncCoordinator.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(supabase)
                .environmentObject(sync)
                .tint(Color.sage)
                .onOpenURL { url in
                    Task { await supabase.handleOpenURL(url) }
                }
                .task {
                    await supabase.restoreSession()
                    if supabase.session != nil, sync.permissionRequested {
                        await sync.sync(days: 7)
                    }
                }
        }
    }
}
