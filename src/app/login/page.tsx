import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { signIn } from "@/app/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand"><span className="brand-mark">D</span> Daymark</div>
        <blockquote>用最低的记录成本，<span>逐渐看清</span>状态、行为与结果之间的关系。</blockquote>
        <p>不是更多数据，也不是更复杂的评分。只保留会进入判断链路的事实。</p>
      </section>
      <section className="login-panel">
        <div className="login-box">
          <p className="eyebrow">PRIVATE WORKSPACE</p>
          <h1>进入你的状态工作台</h1>
          <p>输入邮箱，我们会发送一次性登录链接。无需记住密码。</p>
          {params.sent && <div className="notice success-notice" style={{ marginBottom: 16 }}>登录链接已发送至 {params.sent}，请检查邮箱。</div>}
          {params.error && <div className="notice" style={{ marginBottom: 16 }}>登录没有完成，请检查邮箱或 Supabase 配置后重试。</div>}
          {!configured && <div className="notice" style={{ marginBottom: 16 }}>尚未连接 Supabase。你可以先进入演示模式浏览完整产品。</div>}
          {configured ? (
            <form action={signIn}>
              <input className="input" type="email" name="email" placeholder="你的邮箱" required />
              <button className="btn btn-primary" type="submit">发送登录链接</button>
            </form>
          ) : <Link className="btn btn-primary" href="/">进入演示模式</Link>}
          <div className="privacy-note"><LockKeyhole size={14} />健康与行为数据仅对你的账户可见，数据库通过行级权限隔离。</div>
        </div>
      </section>
    </main>
  );
}
