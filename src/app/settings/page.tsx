import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Activity, CheckCircle2, HeartPulse, Smartphone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteAccount, saveSettings, signOut } from "@/app/actions";
import { getAppData, getHealthConnectionStatus } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; demo?: string; delete_error?: string }> }) {
  const params = await searchParams;
  const [{ demo, profile }, { connection }] = await Promise.all([
    getAppData(),
    getHealthConnectionStatus(),
  ]);
  const lastSyncText = connection.lastSuccessAt
    ? formatDistanceToNow(new Date(connection.lastSuccessAt), { addSuffix: true, locale: zhCN })
    : null;
  return (
    <AppShell demo={demo}>
      <PageHeader eyebrow="SETTINGS" title="设置" description="只保留会影响记录语义、数据单位或隐私边界的设置。" />
      <div className="settings-stack">
        {params.saved && <Alert className="success-notice"><AlertDescription>设置已保存。</AlertDescription></Alert>}
        {params.demo && <Alert className="notice"><AlertDescription>演示模式不会保存设置。</AlertDescription></Alert>}
        {params.delete_error && <Alert variant="destructive"><AlertDescription>账户未删除。请输入大写 DELETE 后再确认。</AlertDescription></Alert>}
        <Card className="surface settings-card health-connection-card gap-0 py-0">
          <div className="health-connection-heading">
            <span className="health-connection-icon"><HeartPulse size={20} /></span>
            <div>
              <div className="health-connection-title">
                <h2>Apple Health</h2>
                <Badge variant={connection.connected ? "secondary" : "outline"}>
                  {connection.connected ? <><CheckCircle2 />已连接</> : "尚未连接"}
                </Badge>
              </div>
              <p>
                {connection.connected
                  ? `${connection.deviceName ?? "iPhone"} · ${lastSyncText ?? "已完成同步"}`
                  : "通过 iPhone companion app 安全同步，不由网页直接读取健康数据。"}
              </p>
            </div>
          </div>
          <div className="health-data-types">
            <span><Smartphone size={14} />睡眠阶段</span>
            <span><Activity size={14} />活动能量</span>
            <span><HeartPulse size={14} />体重</span>
          </div>
          {connection.lastError && <Alert variant="destructive" className="mt-4"><AlertDescription>最近同步失败：{connection.lastError}</AlertDescription></Alert>}
          {!connection.connected && <p className="health-connection-help">在 iPhone App 中使用同一邮箱登录，授权以上三类数据后会自动建立连接。</p>}
        </Card>
        <form action={saveSettings}>
          <Card className="surface settings-card gap-0 py-0">
          <h2>记录偏好</h2><p>日期和滚动窗口均按这里的时区解释。</p>
          <div className="settings-row">
            <div className="input-field"><label htmlFor="timezone">时区</label><select className="select" id="timezone" name="timezone" defaultValue={profile.timezone}><option value="Australia/Sydney">Australia/Sydney</option><option value="Asia/Shanghai">Asia/Shanghai</option><option value="UTC">UTC</option></select></div>
            <div className="input-field"><label htmlFor="boundary_time">晚间边界时间</label><Input className="h-11 rounded-xl bg-card" id="boundary_time" name="boundary_time" type="time" defaultValue={profile.boundary_time.slice(0, 5)} /></div>
            <div className="input-field"><label htmlFor="weight_unit">体重单位</label><select className="select" id="weight_unit" name="weight_unit" defaultValue={profile.weight_unit}><option value="kg">kg</option><option value="lb">lb</option></select></div>
            <div className="input-field"><label htmlFor="energy_unit">活动能量单位</label><select className="select" id="energy_unit" name="energy_unit" defaultValue={profile.energy_unit}><option value="kcal">kcal</option><option value="kj">kJ</option></select></div>
          </div>
          <div className="switch-row" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <div><h2>AI 趋势总结</h2><p style={{ margin: "4px 0 0", color: "var(--muted-foreground)", fontSize: 11 }}>AI 只读取固定规则结果和必要摘要，不读取整库原始数据。</p></div>
            <label className="switch"><input type="checkbox" name="ai_analysis_enabled" defaultChecked={profile.ai_analysis_enabled} /><span /></label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}><Button size="lg" type="submit">保存设置</Button></div>
          </Card>
        </form>
        <Card className="surface settings-card gap-0 py-0">
          <h2>账户</h2><p>{profile.email ?? "演示账户"}</p>
          <form action={signOut}><Button variant="outline" size="lg" type="submit">退出登录</Button></form>
        </Card>
        <Card className="surface settings-card danger gap-0 py-0">
          <h2>删除账户与全部数据</h2><p>此操作会永久删除所有每日记录和设置，无法恢复。输入 DELETE 后确认。</p>
          <form action={deleteAccount} className="settings-row"><Input className="h-11 rounded-xl bg-card" name="confirmation" placeholder="输入 DELETE" autoComplete="off" /><Button variant="destructive" size="lg" type="submit">永久删除</Button></form>
        </Card>
      </div>
    </AppShell>
  );
}
