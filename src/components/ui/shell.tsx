import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SidebarNav, type NavItem } from "./client";

/**
 * Two-column application shell shared by the supplier portal (light) and the
 * platform admin (dark). The buyer account uses the marketplace header instead.
 */
export function AppShell({ tone = "light", brand, switcher, nav, sidebarFooter, topbar, children }: {
  tone?: "light" | "dark";
  brand: ReactNode;
  switcher?: ReactNode;
  nav: NavItem[];
  sidebarFooter?: ReactNode;
  topbar?: ReactNode;
  children: ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <div className="flex min-h-dvh">
      <aside className={cn("sticky top-0 flex h-dvh w-[248px] shrink-0 flex-col gap-5 px-4 py-5",
        dark ? "bg-admin" : "border-r border-line bg-surface")}>
        <div className="px-2">{brand}</div>
        {switcher}
        <SidebarNav items={nav} tone={tone} />
        <div className="flex-1" />
        {sidebarFooter}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar && <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-line bg-surface px-8">{topbar}</header>}
        <main className="flex flex-1 flex-col gap-5 px-8 py-7">{children}</main>
      </div>
    </div>
  );
}
