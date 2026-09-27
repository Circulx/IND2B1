"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export type NavItem = { label: string; href: string; icon: IconName; count?: number | string; exact?: boolean };

/**
 * Sidebar navigation used by the merchant dashboard and admin shells.
 * `usePathname()` returns the path without the app's basePath, so hrefs are
 * written as full paths ("/dashboard/orders").
 */
export function SidebarNav({ items, tone = "light" }: { items: NavItem[]; tone?: "light" | "dark" }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {items.map((it) => {
        const active = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
            className={cn("flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium",
              tone === "light"
                ? active ? "bg-teal-50 font-semibold text-teal-700" : "text-ink-2 hover:bg-subtle"
                : active ? "bg-admin-2 text-white" : "text-admin-muted hover:bg-admin-2 hover:text-white")}>
            <Icon name={it.icon} />
            <span className="flex-1">{it.label}</span>
            {it.count !== undefined && (
              <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                tone === "light" ? "bg-neutral-50 text-neutral-700" : "bg-admin-2 text-white")}>{it.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Quantity input that respects MOQ and order multiples. */
export function QtyStepper({ name = "qty", min = 1, step = 1, defaultValue, unit, onChange }: {
  name?: string; min?: number; step?: number; defaultValue?: number; unit?: string; onChange?: (v: number) => void;
}) {
  const [v, setV] = useState(defaultValue ?? min);
  const set = (n: number) => {
    const next = Math.max(min, Math.round(n / step) * step);
    setV(next);
    onChange?.(next);
  };
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex overflow-hidden rounded-control border border-control bg-surface">
        <button type="button" aria-label="Decrease quantity" onClick={() => set(v - step)} className="flex size-11 items-center justify-center hover:bg-subtle"><Icon name="minus" size={16} /></button>
        <input name={name} aria-label={`Quantity${unit ? ` in ${unit}` : ""}`} inputMode="decimal" value={v}
          onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) { setV(n); onChange?.(n); } }}
          onBlur={() => set(v)}
          className="w-[72px] border-x border-line text-center font-mono text-base focus:outline-none" />
        <button type="button" aria-label="Increase quantity" onClick={() => set(v + step)} className="flex size-11 items-center justify-center hover:bg-subtle"><Icon name="plus" size={16} /></button>
      </div>
      {unit && <span className="text-xs text-muted">MOQ {min} {unit}{step !== 1 ? ` · multiples of ${step}` : ""}</span>}
    </div>
  );
}
