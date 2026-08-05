import Link from "next/link";
import { format } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { Choice, ChoiceField } from "@/components/choice-field";
import { PageHeader } from "@/components/page-header";
import { DatePicker } from "@/components/date-picker";
import { SleepFields } from "@/components/sleep-fields";
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
      <form key={date} action={saveMorning} className="form-shell">
        <input type="hidden" name="record_date" value={date} />
        {demo && <div className="notice">演示模式下提交不会写入数据库；配置 Supabase 后即可保存。</div>}
        <section className="surface form-section">
          <div className="form-section-title"><span>01</span><div><h2>客观数据</h2><p>手动时间会自动计算；未来由 Apple Health 提供精确睡眠样本</p></div></div>
          <div className="input-grid">
            <div className="input-field"><label htmlFor="weight">体重 <em className="optional">可选</em></label><input className="input" id="weight" name="weight" type="number" inputMode="decimal" step="0.1" min="20" max="300" defaultValue={record?.weight ?? ""} placeholder="例如 71.8" /><small>kg</small></div>
            <SleepFields record={record} />
          </div>
        </section>
        <section className="surface form-section">
          <div className="form-section-title"><span>02</span><div><h2>恢复感受</h2><p>按语义选择，不需要重新发明评分标准</p></div></div>
          <ChoiceField label="昨夜睡眠质量">
            {sleepQualityOptions.map(([value, label, description]) => <Choice key={value} name="sleep_quality" value={value} label={label} description={description} defaultChecked={record?.sleep_quality === value} />)}
          </ChoiceField>
          <ChoiceField label="现在有多清醒？">
            {clarityOptions.map(([value, label, description]) => <Choice key={value} name="morning_clarity" value={value} label={label} description={description} defaultChecked={record?.morning_clarity === value} />)}
          </ChoiceField>
        </section>
        <section className="surface form-section">
          <div className="form-section-title"><span>03</span><div><h2>今天的任务强度</h2><p>这是你的主动决策，系统不会替你安排任务</p></div></div>
          <ChoiceField label="今天采用什么强度？">
            {taskIntensityOptions.map(([value, label, description]) => <Choice key={value} name="task_intensity" value={value} label={label} description={description} defaultChecked={record?.task_intensity === value} />)}
          </ChoiceField>
        </section>
        <div className="form-actions"><Link className="btn btn-secondary" href="/">取消</Link><button className="btn btn-primary btn-wide" type="submit">保存晨间记录</button></div>
      </form>
    </AppShell>
  );
}
