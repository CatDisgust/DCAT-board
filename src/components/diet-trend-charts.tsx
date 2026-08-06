"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { analyzeDietHistory } from "@/lib/diet";

type DietAnalysis = ReturnType<typeof analyzeDietHistory>;

const tooltipStyle = { borderRadius: 14, borderColor: "var(--border)", background: "var(--card)", fontSize: 11 };

export function DietTrendCharts({ analysis }: { analysis: DietAnalysis }) {
  const data = analysis.daily.filter((day) => day.hasEntries).map((day) => ({
    date: day.date.slice(5).replace("-", "/"),
    calories: day.values.calories_kcal,
    protein: day.partial.protein_g ? null : day.values.protein_g,
    carbs: day.partial.carbs_g ? null : day.values.carbs_g,
    fat: day.partial.fat_g ? null : day.values.fat_g,
    fiber: day.partial.fiber_g ? null : day.values.fiber_g,
    caffeine: day.partial.caffeine_mg ? null : day.values.caffeine_mg,
  }));
  const hasCaffeine = data.some((day) => typeof day.caffeine === "number" && day.caffeine > 0);
  if (data.length < 2) return <div className="empty-chart">至少记录 2 个实际摄入日后显示饮食趋势</div>;

  return <div className="diet-analysis-charts">
    <div><h3>每日热量</h3><p>仅统计已摄入记录；无记录日期不补零。</p><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 9, left: -18, bottom: 0 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
      <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
      <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} kcal`, "热量"]} />
      <Line type="monotone" dataKey="calories" stroke="var(--chart-1)" strokeWidth={2.2} dot={{ r: 2.5 }} />
    </LineChart></ResponsiveContainer></div></div>
    <div><h3>宏量营养素</h3><p>某天存在未知营养值时，对应曲线留空。</p><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 9, left: -18, bottom: 0 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
      <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
      <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value} g`, ({ protein: "蛋白质", carbs: "碳水", fat: "脂肪" } as Record<string, string>)[String(name)]]} />
      <Legend formatter={(value) => ({ protein: "蛋白质", carbs: "碳水", fat: "脂肪" } as Record<string, string>)[value]} />
      <Line connectNulls={false} type="monotone" dataKey="protein" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 2 }} />
      <Line connectNulls={false} type="monotone" dataKey="carbs" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 2 }} />
      <Line connectNulls={false} type="monotone" dataKey="fat" stroke="var(--chart-5)" strokeWidth={2} dot={{ r: 2 }} />
    </LineChart></ResponsiveContainer></div></div>
    <div><h3>{hasCaffeine ? "膳食纤维与咖啡因" : "膳食纤维"}</h3><p>{hasCaffeine ? "仅在饮品记录包含咖啡因时增加右侧坐标轴。" : "咖啡因无记录时不占用图表空间。"}</p><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: -5, left: -18, bottom: 0 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
      <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
      <YAxis yAxisId="fiber" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
      {hasCaffeine && <YAxis yAxisId="caffeine" orientation="right" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />}
      <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [name === "fiber" ? `${value} g` : `${value} mg`, name === "fiber" ? "膳食纤维" : "咖啡因"]} />
      {hasCaffeine && <Legend formatter={(value) => value === "fiber" ? "膳食纤维" : "咖啡因"} />}
      <Line yAxisId="fiber" connectNulls={false} type="monotone" dataKey="fiber" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 2 }} />
      {hasCaffeine && <Line yAxisId="caffeine" connectNulls={false} type="monotone" dataKey="caffeine" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 2 }} />}
    </LineChart></ResponsiveContainer></div></div>
  </div>;
}
