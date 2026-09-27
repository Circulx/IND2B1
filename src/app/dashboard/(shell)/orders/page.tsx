import Link from "next/link";
import { ORDER_STATUS, PAYMENT_STATUS, listOrders, type OrderStatus } from "@/lib/services";
import { Card, PageHeader, SearchInput, StatusPill, Table, Tabs, Td, Th, formatINR } from "@/components/ui";
import { requireStore } from "@/lib/merchant";

export const metadata = { title: "Orders" };
const TABS: (OrderStatus | "all")[] = ["all", "unfulfilled", "fulfilled", "delivered", "returned", "cancelled"];

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "all", q = "" } = await searchParams;
  const { store } = await requireStore();
  const all = await listOrders(store.id);
  const needle = q.trim().toLowerCase();
  const rows = all.filter((o) => (status === "all" || o.status === status) &&
    (!needle || String(o.number).includes(needle.replace("#", "")) || o.customer.name.toLowerCase().includes(needle) || o.customer.phone.includes(needle)));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Orders" subtitle={`${all.length} orders in total`} />
      <Tabs items={TABS.map((t) => ({
        label: t === "all" ? "All" : ORDER_STATUS[t].label, href: t === "all" ? "/dashboard/orders" : `/dashboard/orders?status=${t}`,
        count: t === "all" ? all.length : all.filter((o) => o.status === t).length, active: status === t,
      }))} />
      <form className="max-w-md"><input type="hidden" name="status" value={status} /><SearchInput placeholder="Search by order number, name or phone" defaultValue={q} /></form>
      <Card>
        <Table>
          <thead><tr><Th>Order</Th><Th>Date</Th><Th>Customer</Th><Th>Payment</Th><Th>Fulfilment</Th><Th right>Items</Th><Th right>Total</Th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-subtle">
                <Td mono><Link href={`/dashboard/orders/${o.id}`} className="font-semibold text-teal-700">#{o.number}</Link></Td>
                <Td className="whitespace-nowrap text-muted">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Td>
                <Td>{o.customer.name}<div className="text-xs text-muted">{o.customer.city}</div></Td>
                <Td><StatusPill tone={PAYMENT_STATUS[o.payment.status].tone}>{PAYMENT_STATUS[o.payment.status].label}</StatusPill></Td>
                <Td><StatusPill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusPill></Td>
                <Td right>{o.lines.reduce((a, l) => a + l.qty, 0)}</Td>
                <Td right>{formatINR(o.totalPaise)}</Td>
              </tr>
            ))}
            {rows.length === 0 && <tr><Td colSpan={7} className="py-10 text-center text-muted">No orders match.</Td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
