import SwiftUI

extension Color {
    static let sage = Color(red: 0.37, green: 0.49, blue: 0.41)
    static let warmBackground = Color(red: 0.965, green: 0.96, blue: 0.935)
    static let warmCard = Color(red: 1.0, green: 0.996, blue: 0.985)
}

struct ContentView: View {
    @EnvironmentObject private var supabase: SupabaseService

    var body: some View {
        ZStack {
            Color.warmBackground.ignoresSafeArea()
            if !AppConfig.shared.isConfigured {
                ConfigurationView()
            } else if supabase.session == nil {
                LoginView()
            } else {
                HealthDashboardView()
            }
        }
    }
}

private struct ConfigurationView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            BrandHeader()
            Text("先连接 Supabase")
                .font(.system(size: 30, weight: .bold, design: .rounded))
            Text("复制 Config/Local.xcconfig.example 为 Local.xcconfig，并填入与网页相同的 Supabase URL 和 publishable key。")
                .foregroundStyle(.secondary)
                .lineSpacing(5)
            Label("配置文件已被 Git 忽略", systemImage: "lock.shield")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Color.sage)
        }
        .padding(28)
    }
}

private struct LoginView: View {
    @EnvironmentObject private var supabase: SupabaseService
    @State private var email = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                BrandHeader()
                    .padding(.bottom, 28)
                Text("让健康数据\n自然进入 Daymark")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .tracking(-1.2)
                Text("使用网页端相同的邮箱登录。授权由 Apple Health 管理，Daymark 只读取睡眠、体重、体脂和活动能量。")
                    .foregroundStyle(.secondary)
                    .lineSpacing(5)

                VStack(spacing: 12) {
                    TextField("你的邮箱", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .padding(15)
                        .background(Color.warmCard, in: RoundedRectangle(cornerRadius: 16))
                    Button {
                        Task { await supabase.sendMagicLink(email: email) }
                    } label: {
                        HStack {
                            if supabase.isSendingLink { ProgressView().tint(.white) }
                            Text(supabase.isSendingLink ? "发送中" : "发送登录链接")
                                .frame(maxWidth: .infinity)
                        }
                        .padding(.vertical, 15)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.roundedRectangle(radius: 16))
                    .disabled(email.isEmpty || supabase.isSendingLink)
                }

                Label("登录邮件必须在这台 iPhone 上打开；在 Mac 上点击无法返回 iPhone App。", systemImage: "iphone")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)

                if let message = supabase.authMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(Color.sage)
                }
            }
            .padding(24)
        }
    }
}

private struct HealthDashboardView: View {
    @EnvironmentObject private var supabase: SupabaseService
    @EnvironmentObject private var sync: SyncCoordinator

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    BrandHeader()
                    Spacer()
                    Button("退出") { Task { await supabase.signOut() } }
                        .font(.footnote.weight(.semibold))
                }
                .padding(.bottom, 10)

                Text("Apple Health")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .tracking(-1)
                Text("在 iPhone 本地读取，经你授权后同步到自己的 Supabase 数据库。")
                    .foregroundStyle(.secondary)

                StatusCard(sync: sync)

                VStack(alignment: .leading, spacing: 14) {
                    Text("读取范围")
                        .font(.headline)
                    DataTypeRow(icon: "bed.double.fill", title: "睡眠阶段", detail: "入睡、清醒、核心、深睡与 REM")
                    DataTypeRow(icon: "figure.walk", title: "活动能量", detail: "按你的时区聚合为每日 kcal")
                    DataTypeRow(icon: "scalemass.fill", title: "体重", detail: "每日使用最新一条测量值")
                    DataTypeRow(icon: "percent", title: "体脂率", detail: "每日使用最新一条测量值")
                }
                .cardStyle()

                Button {
                    Task {
                        if sync.permissionRequested {
                            await sync.sync(days: 30)
                        } else {
                            await sync.authorizeAndSync()
                        }
                    }
                } label: {
                    HStack {
                        if sync.state == .syncing || sync.state == .requestingPermission {
                            ProgressView().tint(.white)
                        }
                        Text(sync.permissionRequested ? "立即同步" : "授权并开始同步")
                            .frame(maxWidth: .infinity)
                    }
                    .padding(.vertical, 15)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 16))
                .disabled(sync.state == .syncing || sync.state == .requestingPermission)

                Label("健康数据不会用于广告、营销或出售。你可以随时在系统设置中撤销权限。", systemImage: "lock.shield")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)
            }
            .padding(24)
        }
        .refreshable { await sync.sync(days: 7) }
    }
}

private struct StatusCard: View {
    @ObservedObject var sync: SyncCoordinator

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: statusIcon)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.sage)
                .frame(width: 44, height: 44)
                .background(Color.sage.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
            VStack(alignment: .leading, spacing: 4) {
                Text(statusTitle).font(.headline)
                Text(statusDetail).font(.footnote).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .cardStyle()
    }

    private var statusIcon: String {
        switch sync.state {
        case .failed: return "exclamationmark.triangle.fill"
        case .syncing, .requestingPermission: return "arrow.triangle.2.circlepath"
        case .success: return "checkmark.circle.fill"
        case .idle: return sync.permissionRequested ? "heart.circle.fill" : "heart.circle"
        }
    }

    private var statusTitle: String {
        switch sync.state {
        case .failed: return "同步需要处理"
        case .syncing: return "正在同步"
        case .requestingPermission: return "等待 Apple Health 授权"
        case .success: return "同步完成"
        case .idle: return sync.permissionRequested ? "后台同步已开启" : "等待授权"
        }
    }

    private var statusDetail: String {
        switch sync.state {
        case let .failed(message): return message
        case .syncing: return "正在读取新增和修改的数据…"
        case .requestingPermission: return "请在系统权限页选择允许读取的数据。"
        case let .success(date): return date.formatted(date: .omitted, time: .shortened)
        case .idle:
            if let date = sync.lastSync {
                return "上次同步 " + date.formatted(date: .abbreviated, time: .shortened)
            }
            return "授权后先同步最近 30 天。"
        }
    }
}

private struct DataTypeRow: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: icon)
                .foregroundStyle(Color.sage)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

private struct BrandHeader: View {
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "leaf.fill")
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(Color.sage, in: RoundedRectangle(cornerRadius: 13))
            VStack(alignment: .leading, spacing: 1) {
                Text("Daymark").font(.headline)
                Text("Health Companion").font(.caption2).foregroundStyle(.secondary)
            }
        }
    }
}

private extension View {
    func cardStyle() -> some View {
        self
            .padding(18)
            .background(Color.warmCard, in: RoundedRectangle(cornerRadius: 20))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.black.opacity(0.08), lineWidth: 1)
            )
    }
}
