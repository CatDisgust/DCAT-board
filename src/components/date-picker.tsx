"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { isRecordDate } from "@/lib/record-date";
import { Input } from "@/components/ui/input";
import { useUnsavedChanges } from "@/components/unsaved-changes";

export function DatePicker({ value }: { value: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { requestNavigation } = useUnsavedChanges();
  return (
    <div className="date-picker-wrap" aria-busy={pending}>
      <Input
        className="date-input h-10 rounded-xl bg-card"
        type="date"
        value={value}
        disabled={pending}
        onChange={(event) => {
          const nextDate = event.target.value;
          if (!isRecordDate(nextDate)) return;
          if (!requestNavigation()) return;
          startTransition(() => router.replace(`${pathname}?date=${encodeURIComponent(nextDate)}`, { scroll: false }));
        }}
        aria-label="选择记录日期"
      />
      {pending && <span>读取中…</span>}
    </div>
  );
}
