import type { ReactNode } from "react";
import { Eyebrow, Icon, Logo } from "@/components/ui";

/** Frame of the super admin sign-in pages: a brand panel on wide screens, a single column on phones. */
export function PortalAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid-cols-1 grid min-h-dvh bg-admin lg:grid-cols-[1fr_minmax(440px,540px)]">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-teal-700/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-10 size-[360px] rounded-full bg-saffron-500/15 blur-3xl" />
        <Logo dark size={24} href="/" />
        <div className="relative flex max-w-lg flex-col gap-5">
          <Eyebrow className="text-saffron-500">Super admin control centre</Eyebrow>
          <h2 className="text-4xl leading-tight text-white xl:text-[44px]">Complete control of the IND2B platform</h2>
          <ul className="grid-cols-1 grid gap-3.5 text-[15px] text-admin-muted">
            <li className="flex gap-3"><Icon name="store" size={20} className="shrink-0 text-saffron-500" /> Every store, order, product and discount across all merchants</li>
            <li className="flex gap-3"><Icon name="users" size={20} className="shrink-0 text-saffron-500" /> Merchants, staff, shopper accounts and their sessions</li>
            <li className="flex gap-3"><Icon name="shield" size={20} className="shrink-0 text-saffron-500" /> KYC, plugin review, plans and system health</li>
            <li className="flex gap-3"><Icon name="file" size={20} className="shrink-0 text-saffron-500" /> Every action written to the audit log with your name</li>
          </ul>
        </div>
        <span className="relative text-xs text-admin-muted">Super admin sessions end after 2 hours without activity.</span>
      </div>
      <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10 sm:px-8 lg:min-h-0">
        <div className="flex w-full max-w-[400px] flex-col gap-8">
          <div className="flex flex-col gap-2 lg:hidden">
            <Logo size={22} href="/" />
            <Eyebrow className="text-saffron-700">Super admin control centre</Eyebrow>
          </div>
          {children}
          <p className="text-center text-xs text-muted">IND2B admins without super admin access sign in at <a href="/admin/login" className="font-semibold text-teal-700">/admin/login</a>.</p>
        </div>
      </div>
    </div>
  );
}
