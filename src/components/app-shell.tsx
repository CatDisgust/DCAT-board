"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Home, Leaf, MoonStar, Ruler, Settings, SunMedium, Utensils } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UnsavedChangesProvider, useUnsavedChanges } from "@/components/unsaved-changes";

const nav = [
  { href: "/", label: "今日", icon: Home },
  { href: "/morning", label: "晨间", icon: SunMedium },
  { href: "/evening", label: "晚间", icon: MoonStar },
  { href: "/diet", label: "饮食", icon: Utensils },
  { href: "/body", label: "身体", icon: Ruler },
  { href: "/history", label: "历史", icon: CalendarDays },
  { href: "/analysis", label: "分析", icon: BarChart3 },
];

export function AppShell({ children, demo = false, wide = false }: { children: ReactNode; demo?: boolean; wide?: boolean }) {
  return <UnsavedChangesProvider><AppFrame demo={demo} wide={wide}>{children}</AppFrame></UnsavedChangesProvider>;
}

function AppFrame({ children, demo, wide }: { children: ReactNode; demo: boolean; wide: boolean }) {
  const pathname = usePathname();
  const { requestNavigation } = useUnsavedChanges();
  const guardNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!requestNavigation()) event.preventDefault();
  };
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Daymark 首页" onClick={guardNavigation}>
          <span className="brand-mark"><Leaf size={18} /></span>
          <span>
            <strong>Daymark</strong>
            <small>个人状态工作台</small>
          </span>
        </Link>
        <nav className="nav-list" aria-label="主导航">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Button key={href} asChild variant={active ? "secondary" : "ghost"} size="lg" className="nav-link">
                <Link href={href} aria-current={active ? "page" : undefined} onClick={guardNavigation}>
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.7} />
                  <span>{label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          {demo && <Badge variant="outline" className="demo-pill"><i />演示数据</Badge>}
          <Button asChild variant={pathname.startsWith("/settings") ? "secondary" : "ghost"} size="lg" className="nav-link">
            <Link href="/settings" aria-current={pathname.startsWith("/settings") ? "page" : undefined} onClick={guardNavigation}>
              <Settings size={18} strokeWidth={1.7} /><span>设置</span>
            </Link>
          </Button>
        </div>
      </aside>
      <main className={`main-content${wide ? " main-content-wide" : ""}`}>{children}</main>
      <nav className="mobile-nav" aria-label="移动端导航">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} className={active ? "active" : ""} onClick={guardNavigation}><Icon size={19} /><span>{label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
