import { HealthNumberField } from "@/components/health-number-field";
import type { DailyRecord } from "@/lib/types";

export function BodyCompositionFields({ record }: { record: DailyRecord | null | undefined }) {
  return (
    <div className="body-composition-fields">
      <HealthNumberField
        id="weight"
        name="weight"
        modeName="weight_entry_mode"
        label="体重"
        unit="kg"
        value={record?.weight ?? null}
        source={record?.weight_source ?? null}
        min={20}
        max={300}
        step={0.1}
        placeholder="例如 71.8"
      />
      <HealthNumberField
        id="body_fat_percentage"
        name="body_fat_percentage"
        modeName="body_fat_entry_mode"
        label="体脂率"
        unit="%"
        value={record?.body_fat_percentage ?? null}
        source={record?.body_fat_source ?? null}
        min={0}
        max={100}
        step={0.1}
        placeholder="例如 18.3"
      />
    </div>
  );
}
