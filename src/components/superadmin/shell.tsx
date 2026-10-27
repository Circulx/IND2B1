"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/icon";

export type PortalNavItem = { label: string; href: string; icon: IconName; count?: number; exact?: boolean };
export type PortalNavGroup = { title?: string; items: PortalNavItem[] };

/**
 * Responsive frame of the super admin control centre.
 *   ≥1024px  fixed dark sidebar + content
 *   <1024px  top bar with a menu button; the sidebar slides in as a drawer
 */
export function PortalShell({ groups, user, children }: { groups: PortalNavGroup[]; user: { name: string; email: string }; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const isActive = (it: PortalNavItem) => (it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`));

  const sidebar = (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <PortalBrand />
        <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex size-10 items-center justify-center rounded-control text-admin-muted hover:bg-admin-2 hover:text-white lg:hidden">
          <Icon name="x" size={20} />
        </button>
      </div>
      <nav aria-label="Super admin" className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {groups.map((g, gi) => (
          <div key={g.title ?? gi} className="mb-1.5">
            {g.title && <div className="px-3 pb-1 pt-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#7c8792]">{g.title}</div>}
            <div className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const active = isActive(it);
                return (
                  <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
                    className={cn("flex h-9 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors",
                      active ? "bg-admin-2 text-white shadow-[inset_3px_0_0_var(--color-saffron-500)]" : "text-admin-muted hover:bg-admin-2 hover:text-white")}>
                    <Icon name={it.icon} />
                    <span className="flex-1 truncate">{it.label}</span>
                    {!!it.count && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron-500 px-1.5 text-[11px] font-semibold text-[#16202a]">{it.count > 99 ? "99+" : it.count}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-admin-2 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-saffron-500 text-[13px] font-bold text-[#16202a]">{initials}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-semibold text-white">{user.name}</div>
            <div className="truncate text-xs text-admin-muted">{user.email}</div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-ground">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] bg-admin lg:block">{sidebar}</aside>

      {/* mobile / tablet drawer */}
      <div className={cn("fixed inset-0 z-40 bg-[#0b1116]/60 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="portal-drawer" aria-label="Menu" aria-hidden={!open}
        className={cn("fixed inset-y-0 left-0 z-50 w-[min(86vw,300px)] bg-admin shadow-2xl transition-transform duration-200 lg:hidden", open ? "translate-x-0" : "-translate-x-full")}
        {...(!open ? { inert: true } : {})}>
        {sidebar}
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-admin-2 bg-admin px-3 text-white sm:px-4 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="portal-drawer"
            className="inline-flex size-10 items-center justify-center rounded-control hover:bg-admin-2">
            <Icon name="list" size={22} />
          </button>
          <PortalBrand compact />
          <span className="ml-auto flex size-8 items-center justify-center rounded-full bg-saffron-500 text-xs font-bold text-[#16202a]" title={user.email}>{initials}</span>
        </header>
        <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}

function PortalBrand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/superadmin" className="flex min-w-0 items-center gap-2.5" aria-label="Super admin home">
      <svg width={compact ? 26 : 30} height={compact ? 26 : 30} viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
        <rect x="1" y="1" width="26" height="26" rx="6" fill="#0B5F5C" />
        <path d="M8 19V9M13 19V9l7 10V9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21.5" cy="6.5" r="2.5" fill="#E07B22" />
      </svg>
      <span className="flex min-w-0 flex-col leading-none">
        <span className={cn("font-display font-extrabold tracking-tight text-white", compact ? "text-[17px]" : "text-[19px]")}>IND2B</span>
        <span className="mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-saffron-500">Super admin</span>
      </span>
    </Link>
  );
}

function SignOutButton() {
  return (
    <form action="/superadmin/logout" method="post">
      <button aria-label="Sign out" title="Sign out" className="inline-flex size-9 items-center justify-center rounded-control text-admin-muted hover:bg-admin-2 hover:text-white">
        <Icon name="logout" size={18} />
      </button>
    </form>
  );
}
