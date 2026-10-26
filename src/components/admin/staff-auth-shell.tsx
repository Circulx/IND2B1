import type { ReactNode } from "react";
import { Eyebrow, Icon, Logo } from "@/components/ui";

/** Two-column frame of the staff sign-in pages (/admin/login, /admin/forgot-password). */
export function StaffAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-admin lg:grid-cols-[1fr_520px]">
      <div className="hidden flex-col justify-between p-14 text-white lg:flex">
        <Logo dark size={24} href="/" />
        <div className="flex max-w-md flex-col gap-4">
          <Eyebrow className="text-saffron-500">Platform admin</Eyebrow>
          <h2 className="text-4xl leading-tight text-white">Run the IND2B platform</h2>
          <ul className="flex flex-col gap-3 text-[15px] text-admin-muted">
            <li className="flex gap-3"><Icon name="shield" size={20} /> KYC verification and store moderation</li>
            <li className="flex gap-3"><Icon name="users" size={20} /> Users, staff roles and shopper accounts</li>
            <li className="flex gap-3"><Icon name="lock" size={20} /> Every action is written to the audit log</li>
          </ul>
        </div>
        <span className="text-xs text-admin-muted">Signed-in staff are signed out after 2 hours without activity.</span>
      </div>
      <div className="flex items-center justify-center bg-surface px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-8">
          <div className="lg:hidden"><Logo size={22} href="/" /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
