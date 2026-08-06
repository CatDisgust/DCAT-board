"use client";

import { useMemo, useState } from "react";
import { PencilLine, RefreshCcw } from "lucide-react";
import { calculateSleepDurationMinutes, formatSleepDuration } from "@/lib/sleep";
import type { DailyRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnsavedChanges } from "@/components/unsaved-changes";

type SleepEntryMode = "health" | "manual";

const clockValue = (iso: string | null | undefined, fallback: string | null | undefined) => {
  if (iso) {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
    }
  }
  return fallback?.slice(0, 5) ?? "";
};

export function SleepFields({ record }: { record: DailyRecord | null }) {
  const { markDirty } = useUnsavedChanges();
  const isManualRecord = record?.sleep_source === "manual";
  const healthStart = clockValue(record?.sleep_start_at, record?.sleep_start_time);
  const healthEnd = clockValue(record?.sleep_end_at, record?.wake_time);
  const [mode, setMode] = useState<SleepEntryMode>(isManualRecord ? "manual" : "health");
  const [start, setStart] = useState(isManualRecord ? record?.sleep_start_time?.slice(0, 5) ?? "" : "");
  const [end, setEnd] = useState(isManualRecord ? record?.wake_time?.slice(0, 5) ?? "" : "");
  const duration = useMemo(() => calculateSleepDurationMinutes(start, end), [start, end]);
  const hasHealthSleep = record?.sleep_source === "apple_health";

  return (
    <>
      <input type="hidden" name="sleep_entry_mode" value={mode} />
      {mode === "health" ? (
        <div className="col-span-full rounded-2xl border border-primary/15 bg-secondary/35 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>睡眠数据</span>
                <span className="source-chip m-0">Apple Health</span>
              </div>
              {hasHealthSleep ? (
                <div className="mt-3 flex flex-wrap gap-x-7 gap-y-2 text-sm tabular-nums">
                  <span><span className="text-muted-foreground">入睡</span> {healthStart || "—"}</span>
                  <span><span className="text-muted-foreground">起床</span> {healthEnd || "—"}</span>
                  <span><span className="text-muted-foreground">时长</span> {formatSleepDuration(record.sleep_duration_minutes)}</span>
                </div>
              ) : isManualRecord ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">保存后会移除当前手动修正，并重新采用 Apple Health 数据。</p>
              ) : (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">等待 Apple Health 同步；晨间记录不会要求你重复填写睡眠时间。</p>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" aria-expanded={false} onClick={() => { setMode("manual"); markDirty(); }}>
              <PencilLine />数据异常，手动修正
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="input-field">
            <label htmlFor="sleep_start_time">入睡时间 <span className="source-chip">手动修正</span></label>
            <Input className="h-11 rounded-xl bg-card" id="sleep_start_time" name="sleep_start_time" type="time" value={start} required onChange={(event) => setStart(event.target.value)} />
          </div>
          <div className="input-field">
            <label htmlFor="wake_time">最终起床时间</label>
            <Input className="h-11 rounded-xl bg-card" id="wake_time" name="wake_time" type="time" value={end} required onChange={(event) => setEnd(event.target.value)} />
          </div>
          <div className="input-field">
            <span>修正后的睡眠时长</span>
            <output className="calculated-value" htmlFor="sleep_start_time wake_time" aria-live="polite">{formatSleepDuration(duration)}</output>
            <Button className="mt-2 px-0" type="button" variant="link" size="sm" onClick={() => { setMode("health"); markDirty(); }}>
              <RefreshCcw />改用 Apple Health
            </Button>
          </div>
        </>
      )}
    </>
  );
}
