"use client";

import { useState } from "react";
import { PencilLine, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import type { HealthValueSource } from "@/lib/types";

type HealthNumberMode = "health" | "manual";

type HealthNumberFieldProps = {
  id: string;
  name: string;
  modeName: string;
  label: string;
  unit: string;
  value: number | null;
  source: HealthValueSource | null;
  min: number;
  max: number;
  step?: number;
  inputMode?: "decimal" | "numeric";
  placeholder: string;
};

export function HealthNumberField({
  id,
  name,
  modeName,
  label,
  unit,
  value,
  source,
  min,
  max,
  step,
  inputMode = "decimal",
  placeholder,
}: HealthNumberFieldProps) {
  const { markDirty } = useUnsavedChanges();
  const isManualRecord = source === "manual";
  const hasHealthValue = source === "apple_health" && value !== null;
  const [mode, setMode] = useState<HealthNumberMode>(isManualRecord ? "manual" : "health");
  const [manualValue, setManualValue] = useState(value === null ? "" : String(value));

  return (
    <div className="health-number-field col-span-full">
      <input type="hidden" name={modeName} value={mode} />
      {mode === "health" ? (
        <div className="health-number-readonly">
          <div>
            <div className="health-number-label"><span>{label}</span><span className="source-chip m-0">Apple Health</span></div>
            {hasHealthValue ? (
              <div className="health-number-value"><strong>{value}</strong><span>{unit}</span></div>
            ) : isManualRecord ? (
              <p>保存后会移除当前手动覆盖，并重新采用 Apple Health 数据。</p>
            ) : (
              <p>Apple Health 暂无这一天的数据；保存其他内容不会把它标记为手动。</p>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => { setMode("manual"); markDirty(); }}>
            <PencilLine />{hasHealthValue ? "数据异常，手动修正" : "手动记录"}
          </Button>
        </div>
      ) : (
        <div className="health-number-manual">
          <div className="input-field">
            <label htmlFor={id}>{label} <span className="source-chip">手动修正</span></label>
            <Input
              className="h-11 rounded-xl bg-card"
              id={id}
              name={name}
              type="number"
              inputMode={inputMode}
              min={min}
              max={max}
              step={step}
              value={manualValue}
              required
              placeholder={placeholder}
              onChange={(event) => setManualValue(event.target.value)}
            />
            <small>{unit} · 保存后将以你的输入为准</small>
          </div>
          <Button type="button" variant="link" size="sm" onClick={() => { setMode("health"); markDirty(); }}>
            <RefreshCcw />改用 Apple Health
          </Button>
        </div>
      )}
    </div>
  );
}
