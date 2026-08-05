import { format } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { EveningForm } from "@/components/evening-form";
import { PageHeader } from "@/components/page-header";
import { DatePicker } from "@/components/date-picker";
import { getRecord } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EveningPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const date = params.date ?? format(new Date(), "yyyy-MM-dd");
  const { demo, record } = await getRecord(date);
  return (
    <AppShell demo={demo}>
      <PageHeader eyebrow="EVENING REVIEW" title="晚间回顾" description="用粗粒度事实结束今天。完成后系统不会弹出建议，也不会要求你继续分析。" actions={<DatePicker value={date} />} />
      <EveningForm date={date} record={record} demo={demo} />
    </AppShell>
  );
}
