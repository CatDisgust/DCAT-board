import Link from "next/link";
import { ArrowRight, Brain, Check, MoonStar, Percent, Scale } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { todayMetricComparison } from "@/lib/analytics";
import { labels } from "@/lib/constants";
import { getAppData } from "@/lib/data";
import { formatCompactSleepDuration } from "@/lib/sleep";
import { todayInTimeZone } from "@/lib/user-date";

export const dynamic = "force-dynamic";

function comparisonCopy(change: number | null, sample: number, unit: string) {
  if (change === null) return sample < 3 ? "至少需要 3 次更早记录才能比较" : "暂无可比较数据";
  if (change === 0) return `与此前 ${sample} 次平均一致`;
  return `较此前 ${sample} 次平均 ${change > 0 ? "+" : ""}${change}${unit}`;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ saved?: string; demo?: string }> }) {
  const params = await searchParams;
  const { demo, profile, records } = await getAppData(28);
  const today = todayInTimeZone(profile.timezone);
  const todayRecord = records.find((record) => record.record_date === today);
  const sleep = todayMetricComparison(records, today, "sleep_duration_minutes");
  const weight = todayMetricComparison(records, today, "weight");
  const bodyFat = todayMetricComparison(records, today, "body_fat_percentage");
  const morningDone = Boolean(todayRecord?.morning_completed_at);
  const clarity = todayRecord?.morning_clarity ? labels[todayRecord.morning_clarity] : null;
  const intensity = todayRecord?.task_intensity ? `${labels[todayRecord.task_intensity]}强度` : null;

  return (
    <AppShell demo={demo}>
      <PageHeader
        eyebrow={format(parseISO(today), "yyyy年 M月 d日 · EEEE", { locale: zhCN })}
        title="今天，先看清状态"
        description="这里只回答今天怎么样。身体变化进入身体模块，睡眠、饮食与边界关系进入分析页。"
      />
      {params.saved && <Alert className="success-notice mb-4"><Check /><AlertDescription>记录已保存，今天的数据与分析已经刷新。</AlertDescription></Alert>}
      {params.demo && <Alert className="notice mb-4"><AlertDescription>当前是演示模式。配置 Supabase 环境变量后，表单会写入你的私有数据库。</AlertDescription></Alert>}

      <div className="today-metric-grid">
        <Card className="surface today-metric-card gap-0 py-0">
          <div className="today-metric-top"><span><MoonStar /></span><p>昨夜睡眠</p></div>
          <strong>{sleep.current === null ? "—" : formatCompactSleepDuration(sleep.current)}</strong>
          <small>{sleep.current === null ? "今天尚无睡眠数据" : comparisonCopy(sleep.change, sleep.sample, " 分钟")}</small>
          <Link href="/morning">{sleep.current === null ? "记录或同步" : "查看晨间"}<ArrowRight /></Link>
        </Card>
        <Card className="surface today-metric-card gap-0 py-0">
          <div className="today-metric-top"><span><Scale /></span><p>体重</p></div>
          <strong>{weight.current === null ? "—" : `${weight.current} kg`}</strong>
          <small>{weight.current === null ? "今天尚无体重数据" : comparisonCopy(weight.change, weight.sample, " kg")}</small>
          <Link href={`/body?date=${today}`}>{weight.current === null ? "记录或同步" : "查看身体数据"}<ArrowRight /></Link>
        </Card>
        <Card className="surface today-metric-card gap-0 py-0">
          <div className="today-metric-top"><span><Percent /></span><p>体脂率</p></div>
          <strong>{bodyFat.current === null ? "—" : `${bodyFat.current}%`}</strong>
          <small>{bodyFat.current === null ? "今天尚无体脂数据" : comparisonCopy(bodyFat.change, bodyFat.sample, " 个百分点")}</small>
          <Link href={`/body?date=${today}`}>{bodyFat.current === null ? "记录或同步" : "查看身体数据"}<ArrowRight /></Link>
        </Card>
        <Card className="surface today-metric-card gap-0 py-0">
          <div className="today-metric-top"><span><Brain /></span><p>今日状态</p></div>
          <strong>{clarity && intensity ? `${clarity} · ${intensity}` : clarity ?? intensity ?? "—"}</strong>
          <small>{morningDone ? "来自今天的晨间记录，不生成综合评分" : "完成晨间记录后显示清醒程度与任务强度"}</small>
          <Link href={`/morning?date=${today}`}>{morningDone ? "查看或修改" : "开始晨间记录"}<ArrowRight /></Link>
        </Card>
      </div>
      <div className="home-analysis-entry">
        <span>睡眠、饮食与边界关系统一放在分析页。</span>
        <Link href="/analysis">查看完整分析<ArrowRight /></Link>
      </div>
    </AppShell>
  );
}
