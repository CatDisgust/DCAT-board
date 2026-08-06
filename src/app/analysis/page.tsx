import { AppShell } from "@/components/app-shell";
import { AiSummary } from "@/components/ai-summary";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { DietTrendCharts } from "@/components/diet-trend-charts";
import { analyzeRecords, formatClock, ruleBasedNarrative } from "@/lib/analytics";
import { analyzeDietHistory, coreNutrientKeys, nutrientMeta } from "@/lib/diet";
import { getAnalysisPageData } from "@/lib/data";
import { formatCompactSleepDuration } from "@/lib/sleep";
import { todayInTimeZone } from "@/lib/user-date";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const { demo, profile, records, dietEntries, nutritionTargets } = await getAnalysisPageData(35);
  const analysis = analyzeRecords(records);
  const diet = analyzeDietHistory(dietEntries, nutritionTargets, todayInTimeZone(profile.timezone));
  const initial = ruleBasedNarrative(analysis);
  return (
    <AppShell demo={demo}>
      <PageHeader eyebrow="ANALYSIS" title="状态关系，不是判决" description="这里观察睡眠、实际饮食与边界行为。饮食统计由结构化记录直接计算，不交给 AI 评价。" />
      <div className="analysis-grid">
        <Card className="surface analysis-summary gap-0 py-0"><p className="card-kicker">平均睡眠</p><strong className="big">{formatCompactSleepDuration(analysis.sleep.averageMinutes)}</strong><p>n={analysis.sleep.sample} · 最近 7 天</p></Card>
        <Card className="surface analysis-summary gap-0 py-0"><p className="card-kicker">边界遵守率</p><strong className="big">{analysis.boundary.adherenceRate ?? "—"}%</strong><p>n={analysis.boundary.sample} · 最近 7 天</p></Card>
        <Card className="surface analysis-summary gap-0 py-0"><p className="card-kicker">7 日平均热量</p><strong className="big">{diet.average7 ?? "—"}<small className="analysis-unit"> kcal</small></strong><p>n={diet.average7Sample} 个有记录日 · 不含计划</p></Card>
        <Card className="surface analysis-summary gap-0 py-0"><p className="card-kicker">30 日平均热量</p><strong className="big">{diet.average30 ?? "—"}<small className="analysis-unit"> kcal</small></strong><p>n={diet.average30Sample} 个有记录日 · 无记录日不补零</p></Card>
      </div>
      <Card className="surface analysis-card diet-analysis-overview gap-0 py-0">
        <div><h2>饮食记录质量</h2><p className="page-description">先说明数据边界，再观察营养变化。</p></div>
        <div className="diet-quality-metrics"><span><b>{diet.recordedDays}</b>有记录日</span><span><b>{diet.completeDays}</b>营养完整日</span><span><b>{diet.estimatedMealCount}</b>外食估算项</span><span><b>{diet.estimatedCalorieRatio ?? "—"}%</b>估算热量占比</span></div>
        <div className="diet-target-days">{coreNutrientKeys.filter((key) => nutritionTargets[key] !== null).map((key) => <span key={key}><b>{nutrientMeta[key].label}</b>{diet.targetDays[key] ?? 0} / {diet.recordedDays} 天达到目标</span>)}{coreNutrientKeys.every((key) => nutritionTargets[key] === null) && <p>尚未设置宏量营养目标。</p>}</div>
      </Card>
      <Card className="surface chart-card diet-analysis-card gap-0 py-0"><h2>饮食趋势</h2><p className="page-description">显示最近 30 个日历日的实际记录；未知数据留空，外食估算只进入热量。</p><DietTrendCharts analysis={diet} /></Card>
      <div className="analysis-columns">
        <Card className="surface analysis-card gap-0 py-0">
          <h2>旧版简化问卷信号</h2><p className="page-description">仅保留未迁移的历史晚间问卷；不会覆盖或混入详细营养统计。</p>
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
