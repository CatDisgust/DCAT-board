import { format } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { Choice, ChoiceField } from "@/components/choice-field";
import { PageHeader } from "@/components/page-header";
import { DatePicker } from "@/components/date-picker";
import { SleepFields } from "@/components/sleep-fields";
import { HealthNumberField } from "@/components/health-number-field";
import { Card } from "@/components/ui/card";
import { FormSaveBar, TrackedForm } from "@/components/tracked-form";
import { saveMorning } from "@/app/actions";
import { clarityOptions, sleepQualityOptions, taskIntensityOptions } from "@/lib/constants";
import { getRecord } from "@/lib/data";
import { recordDateOr } from "@/lib/record-date";

export const dynamic = "force-dynamic";

export default async function MorningPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const date = recordDateOr(params.date, format(new Date(), "yyyy-MM-dd"));
  const { demo, record } = await getRecord(date);
  return (
    <AppShell demo={demo}>
      <PageHeader eyebrow="MORNING CHECK-IN" title="晨间状态" description="记录昨夜恢复与当前感受，然后由你决定今天能承受多少认知工作。" actions={<DatePicker value={date} />} />
      <TrackedForm key={date} action={saveMorning} className="form-shell">
        <input type="hidden" name="record_date" value={date} />
        {demo && <div className="notice">演示模式下提交不会写入数据库；配置 Supabase 后即可保存。</div>}
        <Card className="surface form-section gap-0 py-0">
          <div className="form-section-title"><span>01</span><div><h2>客观数据</h2><p>睡眠默认来自 Apple Health；只有数据异常时才需要手动修正</p></div></div>
          <div className="input-grid">
            <HealthNumberField id="weight" name="weight" modeName="weight_entry_mode" label="体重" unit="kg" value={record?.weight ?? null} source={record?.weight_source ?? null} min={20} max={300} step={0.1} placeholder="例如 71.8" />
            <SleepFields record={record} />
          </div>
        </Card>
        <Card className="surface form-section gap-0 py-0">
          <div className="form-section-title"><span>02</span><div><h2>恢复感受</h2><p>按语义选择，不需要重新发明评分标准</p></div></div>
          <ChoiceField label="昨夜睡眠质量">
            {sleepQualityOptions.map(([value, label, description]) => <Choice key={value} name="sleep_quality" value={value} label={label} description={description} defaultChecked={record?.sleep_quality === value} />)}
          </ChoiceField>
          <ChoiceField label="现在有多清醒？">
            {clarityOptions.map(([value, label, description]) => <Choice key={value} name="morning_clarity" value={value} label={label} description={description} defaultChecked={record?.morning_clarity === value} />)}
          </ChoiceField>
        </Card>
        <Card className="surface form-section gap-0 py-0">
          <div className="form-section-title"><span>03</span><div><h2>今天的任务强度</h2><p>这是你的主动决策，系统不会替你安排任务</p></div></div>
          <ChoiceField label="今天采用什么强度？">
            {taskIntensityOptions.map(([value, label, description]) => <Choice key={value} name="task_intensity" value={value} label={label} description={description} defaultChecked={record?.task_intensity === value} />)}
          </ChoiceField>
        </Card>
        <FormSaveBar submitLabel="保存晨间记录" />
      </TrackedForm>
    </AppShell>
  );
}
