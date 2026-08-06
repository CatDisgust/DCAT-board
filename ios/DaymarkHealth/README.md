# Daymark Health Companion

Daymark 的 iPhone companion app。它以只读方式访问 Apple Health，将睡眠阶段、体重、体脂率和每日活动能量同步到现有 Supabase 项目。

## 数据流

Apple Health → iPhone 本地标准化 → ingest_health_samples RPC → health_samples → daily_records

同步不会覆盖来源为 manual 的体重、体脂、睡眠或活动能量。HealthKit 的 query anchor 仅保存在设备本地，成功上传后才推进。

## 本地配置

1. 当前工作区已经生成被 Git 忽略的 `Config/Local.xcconfig`，项目 URL 已填入；只需从网页 `.env.local` 复制 publishable/anon key。
2. Supabase Authentication 已允许 `daymark://auth-callback`。
3. 新机器上可从 `Config/Local.xcconfig.example` 重新创建本地配置，然后执行 `xcodegen generate`。
4. 在 Xcode 中安装 iOS Platform，选择你的 Development Team 和真机 iPhone。

HealthKit 授权必须在真机上验证。模拟器仅用于编译和 UI 检查。

## 首次同步

用户使用同一邮箱登录并授权后，App 同步最近 30 天。之后：

- App 启动时补齐最近 7 天；
- 下拉或点击“立即同步”手动刷新；
- HealthKit observer 在系统允许时唤醒 App，随后通过 anchored query 读取变化。

后台同步由 iOS 调度，不保证秒级实时；手机锁定期间 HealthKit 加密也可能延迟读取。
