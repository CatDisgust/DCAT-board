"use client";

import { useState } from "react";
import { saveEvening } from "@/app/actions";
import { Choice, ChoiceField, Segmented } from "@/components/choice-field";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { HealthNumberField } from "@/components/health-number-field";
import { violationReasons } from "@/lib/constants";
import type { DailyRecord } from "@/lib/types";
import { FormSaveBar, TrackedForm } from "@/components/tracked-form";

const yesNo = [["false", "没有"], ["true", "有"]] as const;
const yesNoNeutral = [["false", "没有"], ["true", "有"]] as const;

export function EveningForm({ date, record, demo }: { date: string; record: DailyRecord | null; demo: boolean }) {
  const [violated, setViolated] = useState(record?.boundary_violated === true);
  const [reason, setReason] = useState(record?.boundary_violation_reason ?? "");
  return (
    <TrackedForm action={saveEvening} className="form-shell">
      <input type="hidden" name="record_date" value={date} />
      {demo && <div className="notice">演示模式下提交不会写入数据库；配置 Supabase 后即可保存。</div>}
      <Card className="surface form-section gap-0 py-0">
        <div className="form-section-title"><span>01</span><div><h2>活动与饮食轮廓</h2><p>只记录方向性信息，不追求精确热量</p></div></div>
        <HealthNumberField id="active_energy_kcal" name="active_energy_kcal" modeName="active_energy_entry_mode" label="活动能量" unit="kcal" value={record?.active_energy_kcal ?? null} source={record?.active_energy_source ?? null} min={0} max={5000} step={1} inputMode="numeric" placeholder="例如 560" />
        <aside className="nutrition-guide" aria-label="饮食份量判断标准">
          <div className="nutrition-guide-title"><b>先用标准份量校准主观判断</b><span>19–50 岁成年人默认参考；活动量和个人目标不同可调整</span></div>
          <div><b>蛋白质类 · 2.5–3 份/日</b><span>1 份 ≈ 80g 熟禽肉、100g 熟鱼、2 个蛋或 170g 豆腐</span></div>
          <div><b>蔬菜 · 5–6 份/日</b><span>1 份 ≈ 75g、半杯熟蔬菜或一杯生菜</span></div>
          <div><b>谷物主食 · 约 6 份/日</b><span>1 份 ≈ 半杯熟米饭/面条或一片面包，优先全谷物</span></div>
        </aside>
        <div className="compact-grid">
          <ChoiceField label="今天吃了几餐？"><Segmented name="meal_count" defaultValue={record?.meal_count} options={[["1", "1 餐"], ["2", "2 餐"], ["3", "3 餐"], ["4", "4+ 餐"]]} /></ChoiceField>
          <ChoiceField label="有大餐吗？"><Segmented name="had_large_meal" defaultValue={record?.had_large_meal} options={yesNo} /></ChoiceField>
          <ChoiceField label="有明显过饱吗？"><Segmented name="overeating" defaultValue={record?.overeating} options={yesNo} /></ChoiceField>
          <ChoiceField label="有夜宵吗？"><Segmented name="late_night_eating" defaultValue={record?.late_night_eating} options={yesNo} /></ChoiceField>
          <ChoiceField label="高油高糖程度"><Segmented name="high_fat_sugar_level" defaultValue={record?.high_fat_sugar_level} options={[["none", "几乎没有"], ["small", "少量"], ["significant", "明显"]]} /></ChoiceField>
          <ChoiceField label="蛋白质" hint="按全天总量与上方参考目标比较"><Segmented name="protein_level" defaultValue={record?.protein_level} options={[["insufficient", "少于目标"], ["roughly_enough", "接近目标"], ["sufficient", "达到目标"]]} /></ChoiceField>
          <ChoiceField label="蔬菜" hint="先估算标准份数，再作方向判断"><Segmented name="vegetable_level" defaultValue={record?.vegetable_level} options={[["insufficient", "少于目标"], ["roughly_enough", "接近目标"], ["sufficient", "达到目标"]]} /></ChoiceField>
          <ChoiceField label="主食份量" hint="这里比较个人能量计划，不把越少视为越好"><Segmented name="carbohydrate_amount" defaultValue={record?.carbohydrate_amount} options={[["low", "低于计划"], ["moderate", "符合计划"], ["high", "高于计划"]]} /></ChoiceField>
          <ChoiceField label="整体摄入感受"><Segmented name="overall_intake" defaultValue={record?.overall_intake} options={[["low", "偏少"], ["moderate", "适中"], ["high", "偏多"], ["excessive", "明显过多"]]} /></ChoiceField>
          <ChoiceField label="饥饿影响入睡？"><Segmented name="hunger_affected_sleep" defaultValue={record?.hunger_affected_sleep} options={yesNoNeutral} /></ChoiceField>
        </div>
      </Card>
      <Card className="surface form-section gap-0 py-0">
        <div className="form-section-title"><span>02</span><div><h2>20:00 后认知边界</h2><p>关注是否展开开放式任务，而不是具体做了多久</p></div></div>
        <ChoiceField label="边界后是否执行或展开了开放式任务？">
          <div onChange={(event) => setViolated((event.target as HTMLInputElement).value === "true")}>
            <div className="choice-grid">
              <Choice name="boundary_violated" value="false" label="没有，遵守了边界" description="即使想到事情，也只做了简短记录" defaultChecked={record?.boundary_violated === false} />
              <Choice name="boundary_violated" value="true" label="有，违反了边界" description="进行了会持续展开的思考、研究或构建" defaultChecked={record?.boundary_violated === true} />
            </div>
          </div>
        </ChoiceField>
        {violated && (
          <div className="reveal-panel">
            <ChoiceField label="最主要的原因是什么？" hint="只选最能解释今晚行为的一项">
              <div onChange={(event) => setReason((event.target as HTMLInputElement).value)}>
                {violationReasons.map(([value, label]) => <Choice key={value} name="boundary_violation_reason" value={value} label={label} defaultChecked={record?.boundary_violation_reason === value} required />)}
              </div>
            </ChoiceField>
            {reason === "other" && <div className="input-field"><label htmlFor="boundary_other_note">简短说明</label><Textarea className="min-h-24 rounded-xl bg-card" id="boundary_other_note" name="boundary_other_note" maxLength={120} defaultValue={record?.boundary_other_note ?? ""} placeholder="最多 120 字" /></div>}
          </div>
        )}
        <ChoiceField label="现在脑中是否仍不断展开新的想法？" hint="不是“有没有想法”，而是想法是否难以自然收束">
          <Segmented name="thoughts_expanding_at_night" defaultValue={record?.thoughts_expanding_at_night} options={[["false", "没有，能收束"], ["true", "有，仍在展开"]]} />
        </ChoiceField>
      </Card>
      <FormSaveBar submitLabel="保存晚间记录" />
    </TrackedForm>
  );
}
