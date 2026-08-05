"use client";

import { useMemo, useState } from "react";
import { calculateSleepDurationMinutes, formatSleepDuration } from "@/lib/sleep";
import type { DailyRecord } from "@/lib/types";

export function SleepFields({ record }: { record: DailyRecord | null }) {
  const [start, setStart] = useState(record?.sleep_start_time?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(record?.wake_time?.slice(0, 5) ?? "");
  const duration = useMemo(() => calculateSleepDurationMinutes(start, end), [start, end]);

  return (
    <>
      <div className="input-field">
        <label htmlFor="sleep_start_time">入睡时间</label>
        <input className="input" id="sleep_start_time" name="sleep_start_time" type="time" value={start} onChange={(event) => setStart(event.target.value)} />
      </div>
      <div className="input-field">
        <label htmlFor="wake_time">最终起床时间</label>
        <input className="input" id="wake_time" name="wake_time" type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
      </div>
      <div className="input-field">
        <span>睡眠时长</span>
        <output className="calculated-value" htmlFor="sleep_start_time wake_time" aria-live="polite">{formatSleepDuration(duration)}</output>
        <small>根据两个时间自动计算，支持跨午夜。</small>
      </div>
    </>
  );
}
