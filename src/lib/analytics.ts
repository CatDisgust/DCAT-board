import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { BodyMeasurement, DailyRecord } from "./types";

export type Trend = "down" | "stable" | "up" | "insufficient";

const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const round = (value: number | null, digits = 1) => value === null ? null : Number(value.toFixed(digits));

const score: Record<string, number> = {
  very_poor: 1, poor: 2, average: 3, good: 4, very_good: 5,
  heavy_brain_fog: 1, tired: 2, normal: 3, clear: 4, very_clear: 5,
};

const bedtimeMinutes = (time: string | null) => {
  if (!time) return null;
  const [hour, minute] = time.split(":").map(Number);
  return (hour < 12 ? hour + 24 : hour) * 60 + minute;
};

function metricTrend(
  recentValues: number[],
  previousValues: number[],
  threshold: number,
) {
  const recentMean = mean(recentValues);
  const previousMean = mean(previousValues);
  const change = recentMean !== null && previousMean !== null ? recentMean - previousMean : null;
  const sufficient = recentValues.length >= 4 && previousValues.length >= 4;
  const trend: Trend = !sufficient || change === null
    ? "insufficient"
    : change < -threshold ? "down" : change > threshold ? "up" : "stable";
  return {
    trend,
    recentMean: round(recentMean, 2),
    previousMean: round(previousMean, 2),
    change: round(change, 2),
    sample: recentValues.length,
  };
}

export function todayMetricComparison(
  input: DailyRecord[],
  date: string,
  field: "sleep_duration_minutes" | "weight" | "body_fat_percentage",
) {
  const records = [...input].sort((a, b) => a.record_date.localeCompare(b.record_date));
  const current = records.find((record) => record.record_date === date)?.[field] ?? null;
  const previousValues = records
    .filter((record) => record.record_date < date && record[field] !== null)
    .slice(-7)
    .map((record) => record[field] as number);
  const baseline = previousValues.length >= 3 ? mean(previousValues) : null;
  return {
    current,
    baseline: round(baseline, field === "sleep_duration_minutes" ? 0 : 2),
    change: current !== null && baseline !== null
      ? round(current - baseline, field === "sleep_duration_minutes" ? 0 : 2)
      : null,
    sample: previousValues.length,
  };
}

export function analyzeBodyMeasurements(input: BodyMeasurement[]) {
  const measurements = [...input].sort((a, b) => a.measurement_date.localeCompare(b.measurement_date));
  const latest = measurements.at(-1) ?? null;
  const previous = measurements.at(-2) ?? null;
  const change = latest && previous ? {
    chest: round(latest.chest_cm - previous.chest_cm, 1),
    waist: round(latest.waist_cm - previous.waist_cm, 1),
    hip: round(latest.hip_cm - previous.hip_cm, 1),
  } : { chest: null, waist: null, hip: null };
  return { latest, previous, change, chart: measurements.slice(-12) };
}

export function analyzeRecords(input: DailyRecord[], thresholdKg = 0.2) {
  const records = [...input].sort((a, b) => a.record_date.localeCompare(b.record_date));
  const latestDate = records.at(-1)?.record_date ?? null;
  const recentStart = latestDate ? format(addDays(parseISO(latestDate), -6), "yyyy-MM-dd") : null;
  const previousStart = latestDate ? format(addDays(parseISO(latestDate), -13), "yyyy-MM-dd") : null;
  const previousEnd = latestDate ? format(addDays(parseISO(latestDate), -7), "yyyy-MM-dd") : null;
  const recent = latestDate && recentStart
    ? records.filter((record) => record.record_date >= recentStart && record.record_date <= latestDate)
    : [];
  const previous = previousStart && previousEnd
    ? records.filter((record) => record.record_date >= previousStart && record.record_date <= previousEnd)
    : [];
  const recentWeights = recent.flatMap((r) => r.weight === null ? [] : [r.weight]);
  const previousWeights = previous.flatMap((r) => r.weight === null ? [] : [r.weight]);
  const recentBodyFat = recent.flatMap((r) => r.body_fat_percentage === null ? [] : [r.body_fat_percentage]);
  const previousBodyFat = previous.flatMap((r) => r.body_fat_percentage === null ? [] : [r.body_fat_percentage]);
  const weight = metricTrend(recentWeights, previousWeights, thresholdKg);
  const bodyFat = metricTrend(recentBodyFat, previousBodyFat, 0.3);

  const eveningRecords = recent.filter((r) => r.evening_completed_at);
  const frequency = (predicate: (record: DailyRecord) => boolean) =>
    eveningRecords.length ? round(eveningRecords.filter(predicate).length / eveningRecords.length * 100, 0) : null;

  const dietSignals = [
    { code: "late_night_eating", label: "夜宵", rate: frequency((r) => r.late_night_eating === true) },
    { code: "large_meal", label: "大餐", rate: frequency((r) => r.had_large_meal === true) },
    { code: "overeating", label: "过饱", rate: frequency((r) => r.overeating === true) },
    { code: "fat_sugar", label: "明显高油高糖", rate: frequency((r) => r.high_fat_sugar_level === "significant") },
    { code: "high_intake", label: "摄入偏多", rate: frequency((r) => r.overall_intake === "high" || r.overall_intake === "excessive") },
    { code: "low_protein", label: "蛋白质不足", rate: frequency((r) => r.protein_level === "insufficient") },
    { code: "low_vegetable", label: "蔬菜不足", rate: frequency((r) => r.vegetable_level === "insufficient") },
  ].filter((item) => item.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

  // 晚间记录 D 的边界行为，必须与 D+1 晨间记录配对，而非错误使用同一天的昨夜睡眠。
  const paired = records.flatMap((evening) => {
    if (evening.boundary_violated === null) return [];
    const nextDate = format(addDays(parseISO(evening.record_date), 1), "yyyy-MM-dd");
    const nextMorning = records.find((record) => record.record_date === nextDate);
    if (!nextMorning || differenceInCalendarDays(parseISO(nextDate), parseISO(evening.record_date)) !== 1) return [];
    return [{
      violated: evening.boundary_violated,
      thoughts: evening.thoughts_expanding_at_night,
      bedtime: bedtimeMinutes(nextMorning.sleep_start_time),
      duration: nextMorning.sleep_duration_minutes,
      clarity: nextMorning.morning_clarity ? score[nextMorning.morning_clarity] : null,
    }];
  });
  const group = (violated: boolean) => paired.filter((row) => row.violated === violated);
  const summarizeGroup = (rows: ReturnType<typeof group>) => ({
    n: rows.length,
    thoughtsRate: rows.length ? round(rows.filter((r) => r.thoughts).length / rows.length * 100, 0) : null,
    bedtime: round(mean(rows.flatMap((r) => r.bedtime === null ? [] : [r.bedtime])), 0),
    duration: round(mean(rows.flatMap((r) => r.duration === null ? [] : [r.duration])), 0),
    clarity: round(mean(rows.flatMap((r) => r.clarity === null ? [] : [r.clarity])), 1),
  });
  const followed = summarizeGroup(group(false));
  const violated = summarizeGroup(group(true));

  const morningComplete = recent.filter((r) => r.morning_completed_at).length;
  const eveningComplete = recent.filter((r) => r.evening_completed_at).length;
  const completeness = round((morningComplete + eveningComplete) / 14 * 100, 0) ?? 0;
  const avgSleep = round(mean(recent.flatMap((r) => r.sleep_duration_minutes === null ? [] : [r.sleep_duration_minutes])), 0);
  const avgClarity = round(mean(recent.flatMap((r) => r.morning_clarity ? [score[r.morning_clarity]] : [])), 1);
  const adherenceRecords = recent.filter((r) => r.boundary_violated !== null);
  const adherenceRate = adherenceRecords.length
    ? round(adherenceRecords.filter((r) => !r.boundary_violated).length / adherenceRecords.length * 100, 0)
    : null;

  return {
    recent,
    previous,
    completeness,
    morningComplete,
    eveningComplete,
    weight,
    bodyFat,
    diet: { trend: weight.trend, sample: eveningRecords.length, signals: dietSignals.slice(0, 3) },
    sleep: { averageMinutes: avgSleep, averageClarity: avgClarity, sample: recent.filter((r) => r.sleep_duration_minutes !== null).length },
    boundary: { adherenceRate, sample: adherenceRecords.length, followed, violated, sufficient: followed.n >= 3 && violated.n >= 3 },
  };
}

export type AnalysisResult = ReturnType<typeof analyzeRecords>;

export const trendText: Record<Trend, string> = {
  down: "下降",
  stable: "基本持平",
  up: "上升",
  insufficient: "数据不足",
};

export function formatClock(totalMinutes: number | null) {
  if (totalMinutes === null) return "—";
  const normalized = totalMinutes % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function ruleBasedNarrative(analysis: AnalysisResult) {
  const current = analysis.boundary.sample === 0
    ? "最近 7 天的晚间记录不足，还不能描述睡眠与认知边界模式。"
    : `最近 7 天有 ${analysis.boundary.sample} 次有效边界记录；当前只描述睡眠与边界行为，不评价饮食。`;
  const reasons = [
    analysis.sleep.averageMinutes === null ? null : `最近 7 天平均睡眠 ${analysis.sleep.averageMinutes} 分钟`,
    analysis.boundary.adherenceRate === null ? null : `认知边界遵守率为 ${analysis.boundary.adherenceRate}%`,
    analysis.sleep.averageClarity === null ? null : `平均晨间清醒程度为 ${analysis.sleep.averageClarity}/5`,
  ].filter((item): item is string => item !== null);
  const limitations = [
    `近 7 日记录完整度为 ${analysis.completeness}%`,
    analysis.boundary.sufficient ? "边界两组样本已达到最低描述性比较条件" : `边界配对样本仍不足（遵守 n=${analysis.boundary.followed.n}，违反 n=${analysis.boundary.violated.n}）`,
    "这些结果只能描述同时出现的模式，不能证明因果",
  ];
  return { current, reasons: reasons.length ? reasons : ["暂无足够的睡眠与边界记录"], limitations };
}
