import type { Metadata } from "next";
import { AppShell, Icon, Logo } from "@/components/ui";
import { StoreSwitcher } from "@/components/dashboard/store-switcher";
import { dashboardNav } from "@/components/dashboard/nav";
import { countOrders, countQuoteRequests } from "@/lib/services";
import { requireStore, storeHostLabel, storeUrl } from "@/lib/merchant";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · IND2B" }, robots: { index: false, follow: false } };

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const { session, store, stores } = await requireStore();
  const [toFulfil, newQuotes] = await Promise.all([countOrders(store.id, "unfulfilled"), store.installedApps.includes("b2b-wholesale") ? countQuoteRequests(store.id, "new") : 0]);
  const initials = session.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  return (
    <AppShell
      brand={<Logo href="/" size={20} />}
      switcher={<StoreSwitcher stores={stores.map(({ id, name, slug }) => ({ id, name, slug }))} activeId={store.id} />}
      nav={dashboardNav(store, { toFulfil, newQuotes })}
      sidebarFooter={
        <div className="flex flex-col gap-1.5 rounded-card border border-line bg-subtle p-3.5 text-xs">
          <span className="font-semibold capitalize text-teal-700">{store.plan} plan</span>
          <span className="text-muted">{store.installedApps.length} plugins installed</span>
          <a href="/dashboard/settings#plan" className="font-semibold text-ink">Change plan</a>
        </div>
      }
      topbar={
        <>
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-semibold">{store.name}</div>
            <div className="truncate font-mono text-xs text-muted">{storeHostLabel(store)}</div>
          </div>
          <div className="flex-1" />
          <a href={storeUrl(store)} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-2 rounded-control border border-control px-3 text-[13px] font-semibold"><Icon name="eye" size={15} /> View store</a>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-teal-50 text-[13px] font-semibold text-teal-700">{initials}</span>
            <span className="hidden text-[13px] leading-tight md:block">{session.name}<br /><span className="text-xs text-muted">Owner</span></span>
          </div>
          <form action="/logout" method="post"><button className="text-[13px] font-semibold text-muted hover:text-ink">Log out</button></form>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
