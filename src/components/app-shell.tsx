"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Home, MoonStar, Settings, SunMedium } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "今日", icon: Home },
  { href: "/morning", label: "晨间", icon: SunMedium },
  { href: "/evening", label: "晚间", icon: MoonStar },
  { href: "/history", label: "历史", icon: CalendarDays },
  { href: "/analysis", label: "分析", icon: BarChart3 },
];

export function AppShell({ children, demo = false }: { children: ReactNode; demo?: boolean }) {
  const pathname = usePathname();
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Daymark 首页">
          <span className="brand-mark">D</span>
          <span>
            <strong>Daymark</strong>
            <small>个人状态工作台</small>
          </span>
        </Link>
        <nav className="nav-list" aria-label="主导航">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`nav-link ${active ? "active" : ""}`}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.7} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          {demo && <span className="demo-pill"><i /> 演示数据</span>}
          <Link href="/settings" className={`nav-link ${pathname.startsWith("/settings") ? "active" : ""}`}>
            <Settings size={18} strokeWidth={1.7} /> 设置
          </Link>
        </div>
      </aside>
      <main className="main-content">{children}</main>
      <nav className="mobile-nav" aria-label="移动端导航">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} className={active ? "active" : ""}><Icon size={19} /><span>{label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
