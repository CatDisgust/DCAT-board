import { AppShell } from "@/components/app-shell";
import { AiSummary } from "@/components/ai-summary";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { analyzeRecords, formatClock, ruleBasedNarrative } from "@/lib/analytics";
import { getAnalysisPageData } from "@/lib/data";
import { formatCompactSleepDuration } from "@/lib/sleep";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const { demo, profile, records } = await getAnalysisPageData(35);
  const analysis = analyzeRecords(records);
  const initial = ruleBasedNarrative(analysis);
  return (
    <AppShell demo={demo}>
      <PageHeader eyebrow="ANALYSIS" title="状态关系，不是判决" description="这里观察睡眠、饮食与边界行为。身体变化已统一放入身体模块，避免同一结论分散在两处。" />
      <div className="analysis-grid">
        <Card className="surface analysis-summary gap-0 py-0"><p className="card-kicker">平均睡眠</p><strong className="big">{formatCompactSleepDuration(analysis.sleep.averageMinutes)}</strong><p>n={analysis.sleep.sample} · 最近 7 天</p></Card>
        <Card className="surface analysis-summary gap-0 py-0"><p className="card-kicker">边界遵守率</p><strong className="big">{analysis.boundary.adherenceRate ?? "—"}%</strong><p>n={analysis.boundary.sample} · 最近 7 天</p></Card>
      </div>
      <div className="analysis-columns">
        <Card className="surface analysis-card gap-0 py-0">
          <h2>饮食结构信号</h2><p className="page-description">频率只用于指出值得继续观察的模式。</p>
          <div className="signal-list">{analysis.diet.signals.map((signal) => <div className="signal" key={signal.code}><span>{signal.label}</span><b>{signal.rate}%</b></div>)}</div>
          {analysis.diet.signals.length === 0 && <p className="insight-copy">晚间数据不足，暂无可统计信号。</p>}
        </Card>
        <Card className="surface analysis-card gap-0 py-0">
          <h2>边界后的次日状态</h2><p className="page-description">晚间 D 与晨间 D+1 配对，避免日期错位。</p>
          <div className="group-table">
            <div className="group-table-row header"><span>指标</span><span>遵守</span><span>违反</span></div>
            <div className="group-table-row"><span>配对样本</span><span>n={analysis.boundary.followed.n}</span><span>n={analysis.boundary.violated.n}</span></div>
            <div className="group-table-row"><span>思维展开</span><span>{analysis.boundary.followed.thoughtsRate ?? "—"}%</span><span>{analysis.boundary.violated.thoughtsRate ?? "—"}%</span></div>
            <div className="group-table-row"><span>平均入睡</span><span>{formatClock(analysis.boundary.followed.bedtime)}</span><span>{formatClock(analysis.boundary.violated.bedtime)}</span></div>
            <div className="group-table-row"><span>平均睡眠</span><span>{analysis.boundary.followed.duration ?? "—"} 分</span><span>{analysis.boundary.violated.duration ?? "—"} 分</span></div>
            <div className="group-table-row"><span>次日清醒</span><span>{analysis.boundary.followed.clarity ?? "—"}/5</span><span>{analysis.boundary.violated.clarity ?? "—"}/5</span></div>
          </div>
        </Card>
      </div>
      <AiSummary initial={{ ...initial, generatedBy: "rules" }} enabled={profile.ai_analysis_enabled} />
    </AppShell>
  );
}
