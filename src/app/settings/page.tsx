import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { deleteAccount, saveSettings, signOut } from "@/app/actions";
import { getAppData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; demo?: string; delete_error?: string }> }) {
  const params = await searchParams;
  const { demo, profile } = await getAppData();
  return (
    <AppShell demo={demo}>
      <PageHeader eyebrow="SETTINGS" title="设置" description="只保留会影响记录语义、数据单位或隐私边界的设置。" />
      <div className="settings-stack">
        {params.saved && <div className="notice success-notice">设置已保存。</div>}
        {params.demo && <div className="notice">演示模式不会保存设置。</div>}
        {params.delete_error && <div className="notice">账户未删除。请输入大写 DELETE 后再确认。</div>}
        <form action={saveSettings} className="surface settings-card">
          <h2>记录偏好</h2><p>日期和滚动窗口均按这里的时区解释。</p>
          <div className="settings-row">
            <div className="input-field"><label htmlFor="timezone">时区</label><select className="select" id="timezone" name="timezone" defaultValue={profile.timezone}><option value="Australia/Sydney">Australia/Sydney</option><option value="Asia/Shanghai">Asia/Shanghai</option><option value="UTC">UTC</option></select></div>
            <div className="input-field"><label htmlFor="boundary_time">晚间边界时间</label><input className="input" id="boundary_time" name="boundary_time" type="time" defaultValue={profile.boundary_time.slice(0, 5)} /></div>
            <div className="input-field"><label htmlFor="weight_unit">体重单位</label><select className="select" id="weight_unit" name="weight_unit" defaultValue={profile.weight_unit}><option value="kg">kg</option><option value="lb">lb</option></select></div>
            <div className="input-field"><label htmlFor="energy_unit">活动能量单位</label><select className="select" id="energy_unit" name="energy_unit" defaultValue={profile.energy_unit}><option value="kcal">kcal</option><option value="kj">kJ</option></select></div>
          </div>
          <div className="switch-row" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <div><h2>AI 趋势总结</h2><p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11 }}>AI 只读取固定规则结果和必要摘要，不读取整库原始数据。</p></div>
            <label className="switch"><input type="checkbox" name="ai_analysis_enabled" defaultChecked={profile.ai_analysis_enabled} /><span /></label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}><button className="btn btn-primary" type="submit">保存设置</button></div>
        </form>
        <section className="surface settings-card">
          <h2>账户</h2><p>{profile.email ?? "演示账户"}</p>
          <form action={signOut}><button className="btn btn-secondary" type="submit">退出登录</button></form>
        </section>
        <section className="surface settings-card danger">
          <h2>删除账户与全部数据</h2><p>此操作会永久删除所有每日记录和设置，无法恢复。输入 DELETE 后确认。</p>
          <form action={deleteAccount} className="settings-row"><input className="input" name="confirmation" placeholder="输入 DELETE" autoComplete="off" /><button className="btn btn-secondary" type="submit">永久删除</button></form>
        </section>
      </div>
    </AppShell>
  );
}
