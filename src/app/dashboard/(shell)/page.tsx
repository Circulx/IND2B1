import Link from "next/link";
import { ORDER_STATUS, PAYMENT_STATUS, listOrders, listProducts, storeStats } from "@/lib/services";
import { Banner, ButtonLink, Card, Icon, KpiCard, PageHeader, StatusPill, Table, Td, Th, formatINR, formatINRCompact } from "@/components/ui";
import { BarChart } from "@/components/ui/bar-chart";
import { requireStore, storeUrl } from "@/lib/merchant";

export const metadata = { title: "Home" };

export default async function Home({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const { session, store } = await requireStore();
  const [stats, orders, products] = await Promise.all([storeStats(store.id), listOrders(store.id), listProducts(store.id)]);

  const checklist = [
    { done: true, label: "Create your store", href: "/dashboard/settings" },
    { done: products.length > 0, label: "Add your first product", href: "/dashboard/products/new" },
    { done: store.theme.version > 1 || store.status === "active", label: "Customise and publish your theme", href: "/dashboard/editor" },
    { done: store.installedApps.some((a) => a === "razorpay" || a === "cod"), label: "Set up payments", href: "/dashboard/apps" },
    { done: Boolean(store.settings.phone && store.settings.address), label: "Add contact details and address", href: "/dashboard/settings" },
    { done: store.kyc === "verified" || store.kyc === "pending", label: "Verify your business (KYC) to receive payouts", href: "/dashboard/settings#kyc" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const labels = stats.dailySalesPaise.map((_, i) => {
    const d = new Date(Date.now() - (13 - i) * 864e5);
    return i % 2 === 1 ? "" : `${d.getDate()}/${d.getMonth() + 1}`;
  });

  return (
    <div className="flex flex-col gap-6">
      {welcome && (
        <Banner tone="ok" icon="check-circle" action={<a href={storeUrl(store)} target="_blank" rel="noopener" className="text-sm font-semibold text-teal-700">View your store</a>}>
          <strong>{store.name}</strong> is ready. Finish the steps below and your store goes live for shoppers.
        </Banner>
      )}
      <PageHeader title={`Namaste, ${session.name.split(" ")[0]}`} subtitle="Here's what's happening in your store." actions={<>
        <ButtonLink href="/dashboard/products/new" icon="plus" variant="secondary">Add product</ButtonLink>
        <ButtonLink href="/dashboard/editor" icon="palette">Customise store</ButtonLink>
      </>} />

      {doneCount < checklist.length && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Set up your store</h2>
              <p className="text-sm text-muted">{doneCount} of {checklist.length} steps done</p>
            </div>
            {store.status === "setup" && <StatusPill tone="warn">Not live yet</StatusPill>}
          </div>
          <ol className="mt-4 flex flex-col divide-y divide-line-soft">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-3 py-2.5">
                <Icon name={c.done ? "check-circle" : "clock"} size={18} className={c.done ? "text-ok" : "text-muted"} />
                <span className={c.done ? "flex-1 text-muted line-through" : "flex-1"}>{c.label}</span>
                {!c.done && <Link href={c.href} className="text-sm font-semibold text-teal-700">Start</Link>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Sales today" value={formatINR(stats.salesTodayPaise, { decimals: false })} icon="rupee" />
        <KpiCard label="Sales, last 14 days" value={formatINRCompact(stats.sales14dPaise)} icon="chart-line" />
        <KpiCard label="Orders to fulfil" value={stats.toFulfil} hint={<Link href="/dashboard/orders?status=unfulfilled" className="font-semibold text-teal-700">Go to orders</Link>} icon="box" />
        <KpiCard label="Average order value" value={formatINR(stats.aovPaise, { decimals: false })} icon="receipt" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h2 className="font-semibold">Sales, last 14 days</h2>
          <BarChart values={stats.dailySalesPaise.map((p) => Math.round(p / 100))} labels={labels} label="Daily sales in rupees" format={(v) => `₹${v.toLocaleString("en-IN")}`} />
        </Card>
        <Card className="flex flex-col">
          <div className="flex items-center justify-between p-5 pb-3"><h2 className="font-semibold">Recent orders</h2><Link href="/dashboard/orders" className="text-sm font-semibold text-teal-700">View all</Link></div>
          <Table>
            <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Status</Th><Th right>Total</Th></tr></thead>
            <tbody>
              {orders.slice(0, 5).map((o) => (
                <tr key={o.id}>
                  <Td mono><Link href={`/dashboard/orders/${o.id}`} className="font-semibold text-teal-700">#{o.number}</Link></Td>
                  <Td>{o.customer.name}</Td>
                  <Td><StatusPill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusPill></Td>
                  <Td right>{formatINR(o.totalPaise)}<div className="font-sans text-[11px] text-muted">{PAYMENT_STATUS[o.payment.status].label}</div></Td>
                </tr>
              ))}
              {orders.length === 0 && <tr><Td colSpan={4} className="py-8 text-center text-muted">No orders yet. Share your store link to get your first sale.</Td></tr>}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
