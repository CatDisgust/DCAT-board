import { AppShell } from "@/components/app-shell";
import { DatePicker } from "@/components/date-picker";
import { DietWorkspace } from "@/components/diet-workspace";
import { PageHeader } from "@/components/page-header";
import { getDietPageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DietPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const data = await getDietPageData(params.date);

  return (
    <AppShell demo={data.demo} wide>
      <PageHeader
        eyebrow="DIET"
        title="饮食记录"
        description="从自己的食物库组成每一餐；实际摄入与计划分开，未知营养值保持未知。"
        actions={<DatePicker value={data.date} />}
      />
      <DietWorkspace
        key={`${data.date}-${data.entries.map((entry) => `${entry.id}:${entry.updated_at ?? entry.created_at ?? ""}`).join("|")}`}
        {...data}
      />
    </AppShell>
  );
}
