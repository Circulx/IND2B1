import Link from "next/link";
import { Card, KpiCard, PageHeader, StatusPill, Table, Td, Th, buttonClass, formatINR, formatINRCompact, formatNumber } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icon";
import { BarChart } from "@/components/ui/bar-chart";
import { CardHead, Empty, STORE_TONE, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { ORDER_STATUS } from "@/lib/types";
import { navCounts, platformOverview } from "@/lib/services/platform";
import { recentAudit } from "@/lib/audit";
import { requireSuperAdminPortal } from "@/lib/superadmin";

export const metadata = { title: { absolute: "Dashboard · IND2B super admin" } };

const QUICK: { href: string; icon: IconName; label: string; sub: string }[] = [
  { href: "/superadmin/stores", icon: "store", label: "Stores", sub: "Suspend, plan, domain, delete" },
  { href: "/superadmin/users", icon: "users", label: "Users & staff", sub: "Create, roles, disable" },
  { href: "/superadmin/orders", icon: "receipt", label: "Orders", sub: "Override status, payments" },
  { href: "/superadmin/products", icon: "box", label: "Products", sub: "Unpublish or remove" },
  { href: "/superadmin/kyc", icon: "shield", label: "KYC", sub: "Approve, reject, reset" },
  { href: "/superadmin/sessions", icon: "monitor", label: "Sessions", sub: "Sign anyone out" },
];

export default async function SuperAdminHome() {
  const session = await requireSuperAdminPortal();
  const [o, counts, log] = await Promise.all([platformOverview(), navCounts(), recentAudit(8)]);
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const attention = [
    counts.kyc && { href: "/superadmin/kyc", icon: "shield" as const, text: `${counts.kyc} KYC submission${counts.kyc === 1 ? "" : "s"} waiting` },
    counts.plugins && { href: "/superadmin/plugins", icon: "layers" as const, text: `${counts.plugins} plugin${counts.plugins === 1 ? "" : "s"} in review` },
    counts.unfulfilled && { href: "/superadmin/orders?status=unfulfilled", icon: "truck" as const, text: `${counts.unfulfilled} unfulfilled order${counts.unfulfilled === 1 ? "" : "s"}` },
    o.stores.suspended && { href: "/superadmin/stores?status=suspended", icon: "alert" as const, text: `${o.stores.suspended} suspended store${o.stores.suspended === 1 ? "" : "s"}` },
  ].filter(Boolean) as { href: string; icon: IconName; text: string }[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Super admin control centre" title={`${greet}, ${session.name.split(" ")[0]}`}
        subtitle="Everything on IND2B in one place: stores, money, people and security."
        actions={<>
          <Link href="/superadmin/users#create" className={buttonClass("primary", "md")}><Icon name="plus" size={17} />New account</Link>
          <Link href="/admin" className={buttonClass("secondary", "md")}>Classic admin</Link>
        </>} />

      {attention.length > 0 && (
        <div className="grid-cols-1 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {attention.map((a) => (
            <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-card border border-[#e9c9a6] bg-saffron-50 px-4 py-3 text-sm font-medium text-ink hover:brightness-[0.98]">
              <Icon name={a.icon} size={18} className="shrink-0 text-saffron-700" /><span className="flex-1">{a.text}</span><Icon name="chevron-right" size={16} className="text-muted" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="GMV · last 14 days" value={formatINRCompact(o.gmv14dPaise)} hint={`${formatNumber(o.orders14d)} orders`} icon="rupee" />
        <KpiCard label="Subscription MRR" value={formatINRCompact(o.mrrPaise)} hint="Paid plans, live stores" icon="wallet" />
        <KpiCard label="Stores" value={formatNumber(o.stores.total)} hint={`${o.stores.active} live · ${o.stores.setup} in setup`} icon="store" />
        <KpiCard label="Merchants" value={formatNumber(o.users.merchants)} hint={`${o.stores.kycVerified} KYC verified stores`} icon="building" />
        <KpiCard label="Shopper accounts" value={formatNumber(o.users.shoppers)} hint="Across all stores" icon="user" />
        <KpiCard label="Staff" value={o.users.admins + o.users.superadmins} hint={`${o.users.superadmins} super admin${o.users.superadmins === 1 ? "" : "s"}`} icon="users" />
        <KpiCard label="Signed-in devices" value={formatNumber(o.users.devices)} hint={<Link href="/superadmin/sessions" className="font-semibold text-teal-700">Manage sessions</Link>} icon="monitor" />
        <KpiCard label="Disabled accounts" value={o.users.disabled} hint={<Link href="/superadmin/users?tab=disabled" className="font-semibold text-teal-700">Review</Link>} icon="lock" />
      </div>

      <div className="grid-cols-1 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">GMV per day</h2><span className="text-xs text-muted">Excludes cancelled and returned orders</span></div>
          <BarChart values={o.days.map((d) => d.gmvPaise)} labels={o.days.map((d, i) => (i % 2 === 1 || i === o.days.length - 1 ? d.label : ""))} label="GMV per day, last 14 days" format={(v) => formatINRCompact(v)} />
        </Card>
        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold">Stores by plan</h2>
          <BarChart values={o.stores.byPlan.map((p) => p.stores)} labels={o.stores.byPlan.map((p) => p.name)} label="Stores by plan" />
          <div className="mt-2 flex flex-wrap gap-2">
            {(["active", "setup", "suspended"] as const).map((k) => <StatusPill key={k} tone={STORE_TONE[k]!}>{o.stores[k]} {k}</StatusPill>)}
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Quick control</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 transition-colors hover:border-teal-700 hover:bg-teal-100">
              <Icon name={q.icon} size={20} className="text-teal-700" />
              <span className="text-sm font-semibold">{q.label}</span>
              <span className="text-xs text-muted">{q.sub}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid-cols-1 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHead title="Latest orders" action={<Link href="/superadmin/orders" className="text-sm font-semibold text-teal-700">All orders</Link>} />
          <Table>
            <thead><tr><Th>Order</Th><Th className={hideBelow.sm}>Store</Th><Th>Status</Th><Th right>Total</Th></tr></thead>
            <tbody>
              {o.recentOrders.map((r) => (
                <tr key={r.id} className="hover:bg-subtle">
                  <Td><Link href={`/superadmin/orders/${r.id}`} className="font-medium text-teal-700">#{r.number}</Link><div className="text-xs text-muted">{r.customer}</div><div className="text-xs text-muted sm:hidden">{r.storeName}</div></Td>
                  <Td className={hideBelow.sm}>{r.storeName}</Td>
                  <Td><StatusPill tone={ORDER_STATUS[r.status].tone}>{ORDER_STATUS[r.status].label}</StatusPill></Td>
                  <Td right>{formatINR(r.totalPaise)}</Td>
                </tr>
              ))}
              {o.recentOrders.length === 0 && <Empty colSpan={4}>No orders yet.</Empty>}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHead title="Recent activity" action={<Link href="/superadmin/audit" className="text-sm font-semibold text-teal-700">Audit log</Link>} />
          <Table>
            <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(l.at)}</Td>
                  <Td className="text-sm">{l.actorName}</Td>
                  <Td><span className="font-mono text-xs">{l.action}</span><div className="max-w-[220px] truncate font-mono text-[11px] text-muted">{l.target}</div></Td>
                </tr>
              ))}
              {log.length === 0 && <Empty colSpan={3}>No recorded actions yet.</Empty>}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
