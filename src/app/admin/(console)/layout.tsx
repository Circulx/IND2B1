import type { Metadata } from "next";
import { AppShell, Eyebrow, Logo } from "@/components/ui";
import { adminNav } from "@/components/admin/nav";
import { platformStats } from "@/lib/services";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: { default: "Platform admin", template: "%s · IND2B admin" }, robots: { index: false, follow: false } };

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const stats = await platformStats();
  const nav = adminNav(session.role).map((n) => (n.href === "/admin/kyc" && stats.kycPending ? { ...n, count: stats.kycPending } : n.href === "/admin/apps" && stats.appsInReview ? { ...n, count: stats.appsInReview } : n));
  return (
    <AppShell
      tone="dark"
      brand={<div><Logo dark href="/admin" size={20} /><Eyebrow className="mt-1.5 text-saffron-500">{session.role === "superadmin" ? "Super admin" : "Platform admin"}</Eyebrow></div>}
      nav={nav}
      sidebarFooter={
        <div className="flex items-center gap-2.5 px-2 text-[13px] text-[#e3e8ec]">
          <span className="flex size-8 items-center justify-center rounded-full bg-admin-2 font-semibold">{session.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
          <span className="flex-1 leading-tight">{session.name}<br /><span className="text-xs text-admin-muted">{session.role === "superadmin" ? "Super admin" : "IND2B admin"}</span></span>
          <form action="/logout" method="post"><button className="text-xs text-admin-muted hover:text-white">Sign out</button></form>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
