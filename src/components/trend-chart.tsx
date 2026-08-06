"use client";

import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BodyMeasurement, DailyRecord } from "@/lib/types";

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

export function BodyFatChart({ records }: { records: DailyRecord[] }) {
  const data = records.filter((record) => record.body_fat_percentage !== null).map((record) => ({
    date: record.record_date.slice(5).replace("-", "/"),
    bodyFat: record.body_fat_percentage,
  }));
  if (data.length < 2) return <div className="empty-chart">至少记录 2 天体脂后显示曲线</div>;
  const values = data.map((item) => item.bodyFat as number);
  const min = Math.floor((Math.min(...values) - 0.5) * 10) / 10;
  const max = Math.ceil((Math.max(...values) + 0.5) * 10) / 10;
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="bodyFatFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.24} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[min, max]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 14, borderColor: "var(--border)", background: "var(--card)", fontSize: 12 }} formatter={(value) => [`${value}%`, "体脂率"]} />
          <Area type="monotone" dataKey="bodyFat" stroke="var(--chart-2)" strokeWidth={2.4} fill="url(#bodyFatFill)" dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CircumferenceChart({ measurements }: { measurements: BodyMeasurement[] }) {
  const data = measurements.slice(-12).map((measurement) => ({
    date: measurement.measurement_date.slice(5).replace("-", "/"),
    chest: measurement.chest_cm,
    waist: measurement.waist_cm,
    hip: measurement.hip_cm,
  }));
  if (data.length < 2) return <div className="empty-chart">至少记录 2 次三围后显示曲线</div>;
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 14, borderColor: "var(--border)", background: "var(--card)", fontSize: 12 }} formatter={(value, name) => [`${value} cm`, ({ chest: "胸围", waist: "腰围", hip: "臀围" } as Record<string, string>)[String(name)] ?? name]} />
          <Legend formatter={(value) => ({ chest: "胸围", waist: "腰围", hip: "臀围" } as Record<string, string>)[value] ?? value} />
          <Line type="monotone" dataKey="chest" stroke="var(--chart-1)" strokeWidth={2.2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="waist" stroke="var(--chart-3)" strokeWidth={2.2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="hip" stroke="var(--chart-4)" strokeWidth={2.2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
