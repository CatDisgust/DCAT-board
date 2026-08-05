# Daymark · Personal Dashboard MVP

一个基于 Next.js 16、Supabase Auth/Postgres 与固定规则分析的单用户个人状态工作台。

## 系统位置

- **Next.js**：页面、Server Actions、认证会话和服务端分析。
- **Supabase**：Magic Link 登录、Postgres 持久化与 Row Level Security。
- **固定规则层**：移动平均、完整度、饮食频率、跨日边界配对。
- **AI 表达层**：只读取规则输出；未配置 AI 时自动回退为确定性总结。

默认 AI 模型为 `gpt-5.6-terra`，采用低推理强度、`store: false` 与稳定的隐私保护 safety identifier；可通过 `OPENAI_MODEL` 覆盖。

## 本地启动

1. 复制 `.env.example` 为 `.env.local`，填入 Supabase 项目 URL、anon key 和唯一允许登录的邮箱。
2. 按文件名顺序在 Supabase SQL Editor 执行 `supabase/migrations/` 中的 SQL 文件。
3. 在 Supabase Auth 中启用 Email，并把 `http://localhost:3000/auth/confirm` 加入 Redirect URLs。
4. 运行 `npm run dev`。

没有配置 Supabase 时，应用自动进入只读演示模式，便于先检查完整产品体验。

## 睡眠数据

- 手动模式只输入入睡和最终起床时间，睡眠时长由前后端按跨午夜规则自动计算。
- `daily_records` 保存每日聚合结果及数据来源。
- `health_sleep_samples` 为未来的 iPhone companion app 保留 HealthKit 分阶段原始样本；网页本身不能直接读取 Apple Health。

## 验证

- `npm test`：验证两个 7 日窗口、缺失值与 D → D+1 边界配对。
- `npm run lint`：代码检查。
- `npm run build -- --webpack`：生产构建。当前环境下 Webpack 构建比 Turbopack 更稳定。

## 安全边界

- 所有数据表启用 RLS，策略只允许 `auth.uid() = user_id`。
- `ALLOWED_USER_EMAIL` 在应用层限制唯一可用邮箱。
- `OPENAI_API_KEY` 只存在于服务端；AI 不接收完整数据库记录。
- 删除账户调用数据库内的 `delete_own_account()`，并依赖外键级联删除全部个人数据。
