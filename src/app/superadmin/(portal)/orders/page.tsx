import Link from "next/link";
import { listAllOrders, storeOptions } from "@/lib/services/platform";
import { Card, PageHeader, StatusPill, Table, Td, Th, formatINR } from "@/components/ui";
import { Empty, FilterBar, Pager, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatus, type PaymentStatus } from "@/lib/types";
import { requireSuperAdminPortal } from "@/lib/superadmin";

export const metadata = { title: "Orders" };

type SP = { q?: string; status?: string; payment?: string; store?: string; page?: string; ok?: string; error?: string };

/** Orders from every store, newest first. */
export default async function Orders({ searchParams }: { searchParams: Promise<SP> }) {
  const [, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const status = sp.status && sp.status in ORDER_STATUS ? (sp.status as OrderStatus) : undefined;
  const payment = sp.payment && sp.payment in PAYMENT_STATUS ? (sp.payment as PaymentStatus) : undefined;
  const store = sp.store && /^st_[A-Za-z0-9_-]{1,60}$/.test(sp.store) ? sp.store : undefined;
  const [{ orders, total, page, pages }, stores] = await Promise.all([
    listAllOrders({ q: sp.q, status, payment, storeId: store, page: Number(sp.page) || 1 }),
    storeOptions(),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Orders" subtitle="Every order on every store. Open one to override its status or payment." />
      <Flash sp={sp} />
      <FilterBar q={sp.q} placeholder="Order number, ID, customer name, email or phone" clearHref="/superadmin/orders" selects={[
        { name: "store", label: "Store", value: store, options: stores.map((s) => [s.id, s.name]) },
        { name: "status", label: "Status", value: status, options: Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label]) },
        { name: "payment", label: "Payment", value: payment, options: Object.entries(PAYMENT_STATUS).map(([k, v]) => [k, v.label]) },
      ]} />
      <Card>
        <Table>
          <thead><tr><Th>Order</Th><Th className={hideBelow.md}>Store</Th><Th className={hideBelow.lg}>Customer</Th><Th>Status</Th><Th className={hideBelow.sm}>Payment</Th><Th right>Total</Th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-subtle">
                <Td>
                  <Link href={`/superadmin/orders/${o.id}`} className="font-medium text-teal-700">#{o.number}</Link>
                  <div className="whitespace-nowrap text-xs text-muted">{fmtDateTime(o.createdAt)}</div>
                  <div className="text-xs text-muted md:hidden">{o.storeName}</div>
                </Td>
                <Td className={hideBelow.md}><Link href={`/superadmin/stores/${o.storeId}`} className="text-teal-700">{o.storeName}</Link></Td>
                <Td className={hideBelow.lg}><div>{o.customer.name}</div><div className="text-xs text-muted">{o.customer.email}</div></Td>
                <Td><StatusPill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusPill></Td>
                <Td className={hideBelow.sm}><StatusPill tone={PAYMENT_STATUS[o.payment.status].tone} dot={false}>{PAYMENT_STATUS[o.payment.status].label}</StatusPill></Td>
                <Td right>{formatINR(o.totalPaise)}</Td>
              </tr>
            ))}
            {orders.length === 0 && <Empty colSpan={6}>No orders match.</Empty>}
          </tbody>
        </Table>
      </Card>
      <Pager page={page} pages={pages} total={total} base="/superadmin/orders" params={{ q: sp.q, status, payment, store }} />
    </div>
  );
}
