import Link from "next/link";
import { ArrowRight, Check, MoonStar, Sparkles, SunMedium } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { analyzeRecords, trendText } from "@/lib/analytics";
import { getAppData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ saved?: string; demo?: string }> }) {
  const params = await searchParams;
  const { demo, records } = await getAppData(28);
  const analysis = analyzeRecords(records);
  const today = format(new Date(), "yyyy-MM-dd");
  const todayRecord = records.find((r) => r.record_date === today);
  const morningDone = Boolean(todayRecord?.morning_completed_at);
  const eveningDone = Boolean(todayRecord?.evening_completed_at);
  const weightClass = analysis.weight.trend === "down" ? "trend-down" : analysis.weight.trend === "up" ? "trend-up" : "";
  const boundaryCopy = analysis.boundary.sufficient
    ? `违反边界后，思维持续展开为 ${analysis.boundary.violated.thoughtsRate ?? "—"}%；遵守时为 ${analysis.boundary.followed.thoughtsRate ?? "—"}%。`
    : `已有 ${analysis.boundary.sample} 天边界记录。两组各至少 3 个配对样本后再判断关系。`;

  return (
    <AppShell demo={demo}>
      <PageHeader
        eyebrow={format(new Date(), "yyyy年 M月 d日 · EEEE", { locale: zhCN })}
        title="今天，先看清状态"
        description="记录不是目标。它只负责给你足够清晰的证据，帮助你决定今天如何投入。"
      />
      {params.saved && <Alert className="success-notice mb-4"><Check /><AlertDescription>记录已保存，相关趋势已经重新计算。</AlertDescription></Alert>}
      {params.demo && <Alert className="notice mb-4"><AlertDescription>当前是演示模式。配置 Supabase 环境变量后，表单会写入你的私有数据库。</AlertDescription></Alert>}

      <div className="status-grid">
        <Card className="surface status-card gap-0 py-0">
          <div className="status-top"><span className="status-icon"><SunMedium size={19} /></span><Badge variant={morningDone ? "secondary" : "outline"}>{morningDone ? "已完成" : "待记录"}</Badge></div>
          <h2>晨间状态</h2>
          <p>{morningDone ? "昨夜睡眠与当前清醒程度已记录" : "约 1 分钟 · 睡眠、清醒与任务强度"}</p>
          <Link className="card-action" href="/morning">{morningDone ? "查看或修改" : "开始晨间记录"}<ArrowRight size={13} /></Link>
        </Card>
        <Card className="surface status-card gap-0 py-0">
          <div className="status-top"><span className="status-icon evening"><MoonStar size={19} /></span><Badge variant={eveningDone ? "secondary" : "outline"}>{eveningDone ? "已完成" : "待记录"}</Badge></div>
          <h2>晚间回顾</h2>
          <p>{eveningDone ? "饮食结构与晚间边界已记录" : "约 1 分钟 · 饮食、活动与认知边界"}</p>
          <Link className="card-action" href="/evening">{eveningDone ? "查看或修改" : "开始晚间记录"}<ArrowRight size={13} /></Link>
        </Card>
      </div>

      <div className="section-heading"><h2>最近 7 天</h2><Link href="/analysis">查看完整分析 →</Link></div>
      <div className="insight-grid">
        <Card className="surface insight-card gap-0 py-0">
          <p className="card-kicker">体重与饮食方向</p>
          <div className="metric-row">
            <strong className={`metric ${weightClass}`}>{trendText[analysis.weight.trend]}</strong>
            {analysis.weight.change !== null && <span className="metric-suffix">{analysis.weight.change > 0 ? "+" : ""}{analysis.weight.change} kg / 两个 7 日均值</span>}
          </div>
          <p className="insight-copy">
            {analysis.weight.trend === "down" && "当前记录更接近减脂方向。该判断来自移动平均，不使用单日波动。"}
            {analysis.weight.trend === "stable" && "当前记录更接近体重维持。继续观察饮食结构与活动变化。"}
            {analysis.weight.trend === "up" && "当前记录更接近增重方向。以下高频饮食信号值得继续观察。"}
            {analysis.weight.trend === "insufficient" && "最近与前一窗口都至少需要 4 天体重数据，才能形成方向判断。"}
          </p>
          <div className="signal-list">
            {analysis.diet.signals.slice(0, 2).map((signal) => <div className="signal" key={signal.code}><span>{signal.label}</span><b>{signal.rate}% 的已记录晚间</b></div>)}
          </div>
        </Card>
        <Card className="surface insight-card gap-0 py-0">
          <p className="card-kicker">记录完整度</p>
          <div className="metric-row"><strong className="metric">{analysis.completeness}%</strong><span className="metric-suffix">过去 7 天</span></div>
          <Progress className="my-[18px] h-2" value={analysis.completeness} />
          <div className="meta-row"><span>晨间 {analysis.morningComplete}/7</span><span>晚间 {analysis.eveningComplete}/7</span></div>
          <p className="insight-copy">缺失不会被记作 0。完整度只决定结论边界，不阻止你保存任何一天。</p>
        </Card>
        <Card className="surface insight-card span-2 gap-0 py-0">
          <p className="card-kicker">晚间边界观察</p>
          <div className="metric-row"><strong className="metric">{analysis.boundary.adherenceRate ?? "—"}%</strong><span className="metric-suffix">边界遵守率 · n={analysis.boundary.sample}</span></div>
          <p className="insight-copy">{boundaryCopy}</p>
          <Alert className="notice mt-4"><Sparkles /><AlertDescription>这里只呈现描述性关系，不把少量样本中的相关性解释成因果。</AlertDescription></Alert>
        </Card>
      </div>
    </AppShell>
  );
}
