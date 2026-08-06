"use client";

import { Ruler, Save } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveBodyMeasurement } from "@/app/actions";
import { TrackedForm } from "@/components/tracked-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BodyMeasurement } from "@/lib/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}><Save />{pending ? "保存中…" : "保存三围"}</Button>;
}

function delta(value: string, previous: number | undefined) {
  if (!value.trim()) return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || previous === undefined) return "—";
  const change = Number((parsed - previous).toFixed(1));
  return `${change > 0 ? "+" : ""}${change.toFixed(1)} cm`;
}

export function BodyMeasurementForm({
  date,
  current,
  previous,
}: {
  date: string;
  current: BodyMeasurement | null;
  previous: BodyMeasurement | null;
}) {
  const [chest, setChest] = useState(current ? String(current.chest_cm) : "");
  const [waist, setWaist] = useState(current ? String(current.waist_cm) : "");
  const [hip, setHip] = useState(current ? String(current.hip_cm) : "");
  const fields = [
    { id: "chest_cm", label: "胸围", value: chest, setValue: setChest, previous: previous?.chest_cm },
    { id: "waist_cm", label: "腰围", value: waist, setValue: setWaist, previous: previous?.waist_cm },
    { id: "hip_cm", label: "臀围", value: hip, setValue: setHip, previous: previous?.hip_cm },
  ];

  return (
    <Card className="surface body-form-card body-measurement-card gap-0 py-0">
      <div className="body-card-heading">
        <div><span className="status-icon"><Ruler /></span><div><h2>三围测量</h2><p>三项来自同一次测量，保存时需要全部填写</p></div></div>
        {current && <span className="source-chip">正在编辑当天记录</span>}
      </div>
      {previous ? (
        <div className="previous-measurement">
          <div><b>上次测量</b><span>{previous.measurement_date}</span></div>
          <p>胸围 {previous.chest_cm} cm</p><p>腰围 {previous.waist_cm} cm</p><p>臀围 {previous.hip_cm} cm</p>
        </div>
      ) : <div className="previous-measurement empty">还没有更早的三围记录，本次将作为基线。</div>}
      <TrackedForm key={date} action={saveBodyMeasurement} className="body-measurement-form">
        <input type="hidden" name="measurement_date" value={date} />
        <div className="body-measurement-grid">
          {fields.map((field) => (
            <div className="input-field" key={field.id}>
              <label htmlFor={field.id}>{field.label}</label>
              <Input
                id={field.id}
                name={field.id}
                type="number"
                inputMode="decimal"
                min={1}
                max={300}
                step={0.1}
                value={field.value}
                required
                placeholder="cm"
                onChange={(event) => field.setValue(event.target.value)}
              />
              <small>较上次 {delta(field.value, field.previous)}</small>
            </div>
          ))}
        </div>
        <div className="body-inline-actions"><span>数值保留 0.1 cm；同一天再次保存会更新原记录。</span><SubmitButton /></div>
      </TrackedForm>
    </Card>
  );
}
