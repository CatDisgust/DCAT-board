import Link from "next/link";
import { Edit3, MoonStar, SunMedium } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getAppData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { demo, records } = await getAppData(60);
  const sorted = [...records].sort((a, b) => b.record_date.localeCompare(a.record_date));
  return (
    <AppShell demo={demo}>
      <PageHeader eyebrow="HISTORY" title="历史记录" description="补填缺失，或修正过去的记录。保存后，所有趋势都会自动重算。" />
      <div className="surface history-list">
        {sorted.length === 0 && <div className="empty-chart">还没有记录。从今天的晨间或晚间记录开始。</div>}
        {sorted.map((record) => {
          const date = parseISO(record.record_date);
          return (
            <div className="history-row" key={record.record_date}>
              <div className="history-date"><b>{format(date, "M月d日")}</b><span>{format(date, "EEEE", { locale: zhCN })}</span></div>
              <div className={`record-state ${record.morning_completed_at ? "done" : ""}`}><i />晨间 {record.morning_completed_at ? "已记录" : "缺失"}</div>
              <div className={`record-state ${record.evening_completed_at ? "done" : ""}`}><i />晚间 {record.evening_completed_at ? "已记录" : "缺失"}</div>
              <div className="history-actions">
                <Link className="icon-btn" href={`/morning?date=${record.record_date}`} title="编辑晨间"><SunMedium size={15} /></Link>
                <Link className="icon-btn" href={`/evening?date=${record.record_date}`} title="编辑晚间"><MoonStar size={15} /></Link>
              </div>
            </div>
          );
        })}
      </div>
      <div className="notice" style={{ marginTop: 16 }}><Edit3 size={14} style={{ display: "inline", marginRight: 7 }} />历史记录只保留最后更新结果；MVP 不提供版本回滚或批量导入。</div>
    </AppShell>
  );
}
