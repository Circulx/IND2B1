import { listOrders, listProducts, storeStats } from "@/lib/services";
import { Card, KpiCard, PageHeader, Table, Td, Th, formatINR, formatINRCompact } from "@/components/ui";
import { BarChart } from "@/components/ui/bar-chart";
import { requireStore } from "@/lib/merchant";

export const metadata = { title: "Analytics" };

export default async function Analytics() {
  const { store } = await requireStore();
  const [stats, orders, products] = await Promise.all([storeStats(store.id), listOrders(store.id), listProducts(store.id)]);
  const counted = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned");

  const byProduct = new Map<string, { title: string; qty: number; paise: number }>();
  for (const o of counted) for (const l of o.lines) {
    const r = byProduct.get(l.productId) ?? { title: l.title, qty: 0, paise: 0 };
    r.qty += l.qty; r.paise += l.qty * l.unitPricePaise; byProduct.set(l.productId, r);
  }
  const top = [...byProduct.values()].sort((a, b) => b.paise - a.paise).slice(0, 6);
  const byState = new Map<string, number>();
  for (const o of counted) byState.set(o.customer.state, (byState.get(o.customer.state) ?? 0) + o.totalPaise);
  const cod = counted.filter((o) => o.payment.method === "cod").length;
  const returned = orders.filter((o) => o.status === "returned").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Analytics" subtitle="Last 14 days unless noted." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Net sales, 14 days" value={formatINRCompact(stats.sales14dPaise)} icon="rupee" />
        <KpiCard label="Orders, all time" value={stats.orders} icon="box" />
        <KpiCard label="Cash on delivery share" value={`${counted.length ? Math.round((cod / counted.length) * 100) : 0}%`} icon="wallet" />
        <KpiCard label="Return rate" value={`${orders.length ? Math.round((returned / orders.length) * 100) : 0}%`} hint={`${products.length} products listed`} icon="undo" />
      </div>
      <Card className="p-5"><h2 className="font-semibold">Daily sales</h2><BarChart values={stats.dailySalesPaise.map((p) => Math.round(p / 100))} label="Daily sales in rupees" format={(v) => `₹${v.toLocaleString("en-IN")}`} /></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><h2 className="p-5 pb-3 font-semibold">Top products</h2>
          <Table><thead><tr><Th>Product</Th><Th right>Units</Th><Th right>Sales</Th></tr></thead>
            <tbody>{top.map((t) => <tr key={t.title}><Td>{t.title}</Td><Td right>{t.qty}</Td><Td right>{formatINR(t.paise, { decimals: false })}</Td></tr>)}
              {top.length === 0 && <tr><Td colSpan={3} className="py-8 text-center text-muted">No sales yet.</Td></tr>}</tbody></Table>
        </Card>
        <Card><h2 className="p-5 pb-3 font-semibold">Sales by state</h2>
          <Table><thead><tr><Th>State</Th><Th right>Sales</Th></tr></thead>
            <tbody>{[...byState.entries()].sort((a, b) => b[1] - a[1]).map(([s, p]) => <tr key={s}><Td>{s}</Td><Td right>{formatINR(p, { decimals: false })}</Td></tr>)}
              {byState.size === 0 && <tr><Td colSpan={2} className="py-8 text-center text-muted">No sales yet.</Td></tr>}</tbody></Table>
        </Card>
      </div>
    </div>
  );
}
