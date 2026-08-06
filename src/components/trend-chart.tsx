"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyRecord } from "@/lib/types";

export function WeightChart({ records }: { records: DailyRecord[] }) {
  const data = records.filter((r) => r.weight !== null).map((r) => ({
    date: r.record_date.slice(5).replace("-", "/"),
    weight: r.weight,
  }));
  if (data.length < 2) return <div className="empty-chart">至少记录 2 天体重后显示曲线</div>;
  const values = data.map((d) => d.weight as number);
  const min = Math.floor((Math.min(...values) - 0.4) * 10) / 10;
  const max = Math.ceil((Math.max(...values) + 0.4) * 10) / 10;
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[min, max]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 14, borderColor: "var(--border)", background: "var(--card)", fontSize: 12 }} formatter={(value) => [`${value} kg`, "体重"]} />
          <Area type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.4} fill="url(#weightFill)" dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
