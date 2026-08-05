"use client";

import { usePathname, useRouter } from "next/navigation";

export function DatePicker({ value }: { value: string }) {
  const pathname = usePathname();
  const router = useRouter();
  return <input className="date-input" type="date" value={value} onChange={(event) => router.push(`${pathname}?date=${event.target.value}`)} aria-label="选择记录日期" />;
}
