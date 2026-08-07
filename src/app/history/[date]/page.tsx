import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowLeft, ChevronRight, Flame, MoonStar, PencilLine, Percent, Ruler, Scale, ShieldCheck, SunMedium, Utensils } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { labels, violationReasons } from "@/lib/constants";
import { getHistoryDetailData } from "@/lib/data";
import { coreNutrientKeys, mealSlots, nutrientMeta, summarizeDietEntries } from "@/lib/diet";
import { isRecordDate } from "@/lib/record-date";
import { formatCompactSleepDuration } from "@/lib/sleep";
import type { DietEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const violationReasonLabels = Object.fromEntries(violationReasons.map(([value, label]) => [value, label]));

function textValue(value: string | null) {
  return value ? labels[value] ?? value : "未记录";
}

function booleanValue(value: boolean | null) {
  return value === null ? "未记录" : value ? "是" : "否";
}

function sourceValue(value: "manual" | "apple_health" | null) {
  if (value === "manual") return "手动记录";
  if (value === "apple_health") return "Apple Health";
  return "暂无来源";
}

function clockValue(value: string | null) {
  return value ? value.slice(0, 5) : "—";
}

function completedValue(value: string | null) {
  return value ? `完成于 ${format(parseISO(value), "M月d日 HH:mm")}` : "尚未填写";
}

function DetailItem({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="history-detail-item">
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function entryAmount(entry: DietEntry) {
  if (entry.source_kind === "meal_estimate") return entry.note || "外食估算";
  return `${formatNumber(entry.standard_amount_snapshot * entry.quantity)} ${entry.standard_unit_snapshot}`;
}

export default async function HistoryDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isRecordDate(date)) notFound();

  const { demo, record, measurement, dietEntries } = await getHistoryDetailData(date);
  if (!record) notFound();

  const parsedDate = parseISO(record.record_date);
  const boundaryReason = record.boundary_violation_reason
    ? violationReasonLabels[record.boundary_violation_reason] ?? record.boundary_violation_reason
    : "未记录";
  const consumedEntries = dietEntries.filter((entry) => entry.status === "consumed");
  const plannedEntries = dietEntries.filter((entry) => entry.status === "planned");
  const dietSummary = summarizeDietEntries(consumedEntries);
  const hasDetailedDiet = consumedEntries.length > 0;

  return (
    <AppShell demo={demo}>
      <PageHeader
        eyebrow="DAILY DETAIL"
        title={format(parsedDate, "M月d日")}
        description={`${format(parsedDate, "yyyy年 · EEEE", { locale: zhCN })} · 查看当天最终保存的数据`}
        actions={<Button asChild variant="outline"><Link href="/history"><ArrowLeft />返回历史</Link></Button>}
      />

      <section aria-labelledby="history-overview-title">
        <div className="history-section-label" id="history-overview-title">当日概览</div>
        <div className="history-metric-grid">
          <Card className="surface history-metric-card gap-0 py-0">
            <span className="history-metric-icon"><Scale /></span>
            <div><p>体重</p><strong>{record.weight === null ? "—" : `${record.weight} kg`}</strong><small>{sourceValue(record.weight_source)}</small></div>
          </Card>
          <Card className="surface history-metric-card gap-0 py-0">
            <span className="history-metric-icon"><Percent /></span>
            <div><p>体脂率</p><strong>{record.body_fat_percentage === null ? "—" : `${record.body_fat_percentage}%`}</strong><small>{sourceValue(record.body_fat_source)}</small></div>
          </Card>
          <Card className="surface history-metric-card gap-0 py-0">
            <span className="history-metric-icon"><MoonStar /></span>
            <div><p>睡眠</p><strong>{formatCompactSleepDuration(record.sleep_duration_minutes)}</strong><small>{sourceValue(record.sleep_source)}</small></div>
          </Card>
          <Card className="surface history-metric-card gap-0 py-0">
            <span className="history-metric-icon"><Flame /></span>
            <div><p>活动能量</p><strong>{record.active_energy_kcal === null ? "—" : `${record.active_energy_kcal} kcal`}</strong><small>{sourceValue(record.active_energy_source)}</small></div>
          </Card>
        </div>
      </section>

      <Card className="surface history-detail-card history-diet-card gap-0 py-0">
        <div className="history-detail-heading">
          <div className="history-detail-title"><span><Utensils /></span><div><h2>当天饮食</h2><p>{hasDetailedDiet ? `${dietSummary.mealCount} 个已摄入餐段 · ${dietSummary.entryCount} 项记录` : "当天没有详细饮食记录"}</p></div></div>
          <Button asChild variant="outline" size="sm"><Link href={`/diet?date=${date}`}><PencilLine />编辑饮食</Link></Button>
        </div>
        <Separator />
        {hasDetailedDiet ? <>
          <div className="history-nutrient-grid">
            {coreNutrientKeys.map((key) => <div className="history-nutrient-item" key={key}>
              <span>{nutrientMeta[key].label}</span>
              <b>{formatNumber(dietSummary.values[key])} <small>{nutrientMeta[key].unit}</small></b>
              {dietSummary.partial[key] && <em>部分营养值未知</em>}
            </div>)}
          </div>
          <div className="history-meal-list">
            {mealSlots.map((slot) => {
              const entries = consumedEntries.filter((entry) => entry.meal_slot === slot.value);
              if (entries.length === 0) return null;
              const summary = summarizeDietEntries(entries);
              return <div className="history-meal-row" key={slot.value}>
                <div className="history-meal-name"><b>{slot.label}</b><span>{formatNumber(summary.values.calories_kcal)} kcal</span></div>
                <div className="history-meal-entries">{entries.map((entry) => <span key={entry.id}><b>{entry.name_snapshot}</b><small>{entryAmount(entry)}</small></span>)}</div>
              </div>;
            })}
          </div>
          {(dietSummary.values.caffeine_mg > 0 || plannedEntries.length > 0) && <div className="history-diet-note">
            {dietSummary.values.caffeine_mg > 0 && <span>咖啡因 <b>{formatNumber(dietSummary.values.caffeine_mg)} mg</b></span>}
            {plannedEntries.length > 0 && <span>另有 <b>{plannedEntries.length}</b> 项计划未计入实际摄入</span>}
          </div>}
        </> : <div className="history-empty-state"><p>这一天尚未使用饮食模块记录实际摄入。</p><Link href={`/diet?date=${date}`}>前往补充记录 <ChevronRight /></Link></div>}
      </Card>

      {measurement && (
        <Card className="surface history-detail-card history-body-card gap-0 py-0">
          <div className="history-detail-heading">
            <div className="history-detail-title"><span><Ruler /></span><div><h2>三围测量</h2><p>当天保存的最终测量结果</p></div></div>
            <Button asChild variant="outline" size="sm"><Link href={`/body?date=${date}`}><PencilLine />编辑</Link></Button>
          </div>
          <Separator />
          <div className="history-detail-list compact">
            <DetailItem label="胸围" value={`${measurement.chest_cm} cm`} />
            <DetailItem label="腰围" value={`${measurement.waist_cm} cm`} />
            <DetailItem label="臀围" value={`${measurement.hip_cm} cm`} />
          </div>
        </Card>
      )}

      <div className="history-section-label history-record-label">状态与复盘</div>
      <div className="history-detail-columns">
        <Card className="surface history-detail-card gap-0 py-0">
          <div className="history-detail-heading">
            <div className="history-detail-title"><span><SunMedium /></span><div><h2>晨间状态</h2><p>{completedValue(record.morning_completed_at)}</p></div></div>
            <div className="history-detail-actions">
              <Badge variant={record.morning_completed_at ? "secondary" : "outline"}>{record.morning_completed_at ? "已记录" : "缺失"}</Badge>
              <Button asChild variant="outline" size="sm"><Link href={`/morning?date=${date}`}><PencilLine />编辑</Link></Button>
            </div>
          </div>
          <Separator />
          <div className="history-detail-list">
            <DetailItem label="入睡时间" value={clockValue(record.sleep_start_time)} />
            <DetailItem label="起床时间" value={clockValue(record.wake_time)} />
            <DetailItem label="睡眠质量" value={textValue(record.sleep_quality)} />
            <DetailItem label="清醒程度" value={textValue(record.morning_clarity)} />
            <DetailItem label="任务强度" value={textValue(record.task_intensity)} />
            <DetailItem label="睡眠来源" value={sourceValue(record.sleep_source)} />
          </div>
        </Card>

        <Card className="surface history-detail-card gap-0 py-0">
          <div className="history-detail-heading">
            <div className="history-detail-title"><span><MoonStar /></span><div><h2>晚间回顾</h2><p>{completedValue(record.evening_completed_at)}</p></div></div>
            <div className="history-detail-actions">
              <Badge variant={record.evening_completed_at ? "secondary" : "outline"}>{record.evening_completed_at ? "已记录" : "缺失"}</Badge>
              <Button asChild variant="outline" size="sm"><Link href={`/evening?date=${date}`}><PencilLine />编辑</Link></Button>
            </div>
          </div>
          <Separator />
          <div className="history-detail-list">
            {!hasDetailedDiet && <DetailItem label="餐次数" value={record.meal_count === null ? "未记录" : `${record.meal_count} 餐`} />}
            {!hasDetailedDiet && <DetailItem label="蛋白质" value={textValue(record.protein_level)} />}
            {!hasDetailedDiet && <DetailItem label="蔬菜" value={textValue(record.vegetable_level)} />}
            {!hasDetailedDiet && <DetailItem label="主食分量" value={textValue(record.carbohydrate_amount)} />}
            <DetailItem label="整体摄入" value={textValue(record.overall_intake)} />
            <DetailItem label="高油高糖" value={textValue(record.high_fat_sugar_level)} />
            <DetailItem label="出现大餐" value={booleanValue(record.had_large_meal)} />
            <DetailItem label="吃到过饱" value={booleanValue(record.overeating)} />
            <DetailItem label="夜宵" value={booleanValue(record.late_night_eating)} />
            <DetailItem label="饥饿影响入睡" value={booleanValue(record.hunger_affected_sleep)} />
          </div>
        </Card>
      </div>

      <Card className="surface history-detail-card history-boundary-card gap-0 py-0">
        <div className="history-detail-heading">
          <div className="history-detail-title"><span><ShieldCheck /></span><div><h2>晚间边界</h2><p>记录行为本身，不对单日表现下结论</p></div></div>
        </div>
        <Separator />
        <div className="history-detail-list compact">
          <DetailItem label="是否违反边界" value={booleanValue(record.boundary_violated)} />
          <DetailItem label="主要原因" value={record.boundary_violated ? boundaryReason : record.boundary_violated === false ? "不适用" : "未记录"} />
          <DetailItem label="思维持续展开" value={booleanValue(record.thoughts_expanding_at_night)} />
          <DetailItem label="其他说明" value={record.boundary_other_note || "无"} />
        </div>
      </Card>
    </AppShell>
  );
}
