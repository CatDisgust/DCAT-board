import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Daymark · 个人状态工作台", template: "%s · Daymark" },
  description: "用最低的记录成本，看清睡眠、饮食、认知边界与状态之间的关系。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
