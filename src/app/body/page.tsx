import Link from "next/link";
import { Check, ChevronRight, Scale } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { saveBodyComposition } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { BodyCompositionFields } from "@/components/body-composition-fields";
import { BodyMeasurementForm } from "@/components/body-measurement-form";
import { DatePicker } from "@/components/date-picker";
import { InlineSubmitButton } from "@/components/inline-submit-button";
import { PageHeader } from "@/components/page-header";
import { TrackedForm } from "@/components/tracked-form";
import { BodyFatChart, CircumferenceChart, WeightChart } from "@/components/trend-chart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { analyzeBodyMeasurements, analyzeRecords, trendText } from "@/lib/analytics";
import { getBodyPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

const delta = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)} cm`;

export default async function BodyPage({ searchParams }: { searchParams: Promise<{ date?: string; saved?: string }> }) {
  const params = await searchParams;
  const data = await getBodyPageData(params.date);
  const { date } = data;
  const analysis = analyzeRecords(data.records);
  const body = analyzeBodyMeasurements(data.measurements);

  return (
    <AppShell demo={data.demo}>
      <PageHeader
        eyebrow="BODY"
        title="身体数据"
        description="每天记录体重与体脂，低频记录三围。身体原始数据、趋势与变化判断统一在这里查看。"
        actions={<DatePicker value={date} />}
      />
      {params.saved && <Alert className="success-notice mb-4"><Check /><AlertDescription>{params.saved === "measurement" ? "三围记录已保存。" : "体重与体脂来源已更新。"}</AlertDescription></Alert>}

      <div className="body-entry-grid">
        <Card className="surface body-form-card body-composition-card gap-0 py-0">
          <div className="body-card-heading">
            <div><span className="status-icon"><Scale /></span><div><h2>体重与体脂</h2><p>默认采用 Apple Health；只有缺失或异常时才手动修正</p></div></div>
          </div>
          <TrackedForm key={`composition-${date}`} action={saveBodyComposition}>
            <input type="hidden" name="record_date" value={date} />
            <BodyCompositionFields record={data.record} />
            <div className="body-inline-actions"><span>手动覆盖会持续保留，直到你主动切回 Apple Health。</span><InlineSubmitButton label="保存身体数据" /></div>
          </TrackedForm>
        </Card>

        <BodyMeasurementForm key={date} date={date} current={data.measurement} previous={data.previousMeasurement} />
      </div>

      <div className="section-heading"><h2>身体趋势</h2><span>体重、体脂与三围统一查看</span></div>
      <div className="analysis-grid">
        <Card className="surface analysis-summary gap-0 py-0"><p className="card-kicker">体重方向</p><strong className="big">{trendText[analysis.weight.trend]}</strong><p>{analysis.weight.change === null ? "相邻两个 7 日窗口各需至少 4 个样本" : `${analysis.weight.change > 0 ? "+" : ""}${analysis.weight.change} kg · 7 日均值变化`}</p></Card>
        <Card className="surface analysis-summary gap-0 py-0"><p className="card-kicker">体脂方向</p><strong className="big">{trendText[analysis.bodyFat.trend]}</strong><p>{analysis.bodyFat.change === null ? "相邻两个 7 日窗口各需至少 4 个样本" : `${analysis.bodyFat.change > 0 ? "+" : ""}${analysis.bodyFat.change} 个百分点 · 7 日均值变化`}</p></Card>
      </div>
      <div className="body-chart-grid">
        <Card className="surface chart-card gap-0 py-0"><h2>体重趋势</h2><p className="page-description">保留单日原始值，方向判断使用相邻两个 7 日窗口。</p><WeightChart records={data.records.slice(-14)} /></Card>
        <Card className="surface chart-card gap-0 py-0"><h2>体脂趋势</h2><p className="page-description">与体重分开呈现，变化单位为百分点。</p><BodyFatChart records={data.records.slice(-14)} /></Card>
      </div>
      <Card className="surface chart-card gap-0 py-0">
        <div className="circumference-heading">
          <div><h2>三围趋势</h2><p className="page-description">最近 12 次独立测量，只描述实际变化，不补齐未测日期。</p></div>
          <div className="circumference-deltas">
            <span>胸围 <b>{delta(body.change.chest)}</b></span><span>腰围 <b>{delta(body.change.waist)}</b></span><span>臀围 <b>{delta(body.change.hip)}</b></span>
          </div>
        </div>
        <CircumferenceChart measurements={body.chart} />
      </Card>

      <div className="section-heading"><h2>近期三围</h2><span>最多显示最近 12 次</span></div>
      <Card className="surface body-history gap-0 py-0">
        {data.measurements.length === 0 && <div className="empty-chart">还没有三围记录。</div>}
        {[...data.measurements].reverse().map((measurement) => {
          const parsedDate = parseISO(measurement.measurement_date);
          return (
            <Link className="body-history-row" href={`/body?date=${measurement.measurement_date}`} key={measurement.measurement_date}>
              <div><b>{format(parsedDate, "M月d日")}</b><span>{format(parsedDate, "EEEE", { locale: zhCN })}</span></div>
              <p>胸 {measurement.chest_cm}</p><p>腰 {measurement.waist_cm}</p><p>臀 {measurement.hip_cm}</p>
              <ChevronRight />
            </Link>
          );
        })}
      </Card>
    </AppShell>
  );
}
