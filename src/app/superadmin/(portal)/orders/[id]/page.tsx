import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/services";
import { getAnyOrder } from "@/lib/services/platform";
import { Button, Card, PageHeader, Select, StatusPill, Table, Td, Th, formatINR } from "@/components/ui";
import { CardHead, DetailList, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/types";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { forceOrderStatusAction, setOrderPaymentAction } from "@/actions/superadmin-portal";

export const metadata = { title: "Order" };

/** One order from any store, with status and payment overrides. */
export default async function OrderControl({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [, { id }, sp] = await Promise.all([requireSuperAdminPortal(), params, searchParams]);
  const order = await getAnyOrder(decodeURIComponent(id));
  if (!order) notFound();
  const store = await getStore(order.storeId);
  const here = `/superadmin/orders/${order.id}`;
  const c = order.customer;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={<Link href="/superadmin/orders" className="text-teal-700">← Orders</Link>}
        title={<span className="flex flex-wrap items-center gap-3">Order #{order.number}<StatusPill tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</StatusPill></span>}
        subtitle={<>{store ? <Link href={`/superadmin/stores/${store.id}`} className="text-teal-700">{store.name}</Link> : order.storeId} · {fmtDateTime(order.createdAt)}</>} />
      <Flash sp={sp} />
      <div className="grid-cols-1 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHead title={`Items (${order.lines.reduce((a, l) => a + l.qty, 0)})`} />
            <Table>
              <thead><tr><Th>Item</Th><Th right className={hideBelow.sm}>Price</Th><Th right>Qty</Th><Th right>Amount</Th></tr></thead>
              <tbody>
                {order.lines.map((l) => (
                  <tr key={`${l.productId}-${l.variantId}`}>
                    <Td><div className="font-medium">{l.title}</div><div className="text-xs text-muted">{l.variantTitle}</div></Td>
                    <Td right className={hideBelow.sm}>{formatINR(l.unitPricePaise, { decimals: true })}</Td>
                    <Td right>{l.qty}</Td>
                    <Td right>{formatINR(l.unitPricePaise * l.qty, { decimals: true })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="ml-auto flex w-full max-w-xs flex-col gap-1.5 p-4 text-sm sm:p-5">
              {([["Subtotal", order.subtotalPaise], ["Shipping", order.shippingPaise], [`Discount${order.discountCode ? ` (${order.discountCode})` : ""}`, -order.discountPaise], ["Tax", order.taxPaise]] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><span className="text-muted">{k}</span><span className="font-mono tabular">{formatINR(v, { decimals: true })}</span></div>
              ))}
              <div className="flex justify-between gap-4 border-t border-line pt-2 font-display text-base font-bold"><span>Total</span><span className="font-mono tabular">{formatINR(order.totalPaise, { decimals: true })}</span></div>
            </div>
          </Card>
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-semibold">Customer</h2>
            <DetailList rows={[
              ["Name", c.name], ["Email", c.email], ["Phone", c.phone || "—"],
              ["Ship to", `${c.address}, ${c.city} ${c.pincode}, ${c.state}`],
              ["Account", order.customerId ? <span key="a" className="font-mono text-xs">{order.customerId}</span> : "Guest checkout"],
              ["Order ID", <span key="o" className="break-all font-mono text-xs">{order.id}</span>],
            ]} />
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="font-semibold">Order status</h2>
            <p className="text-sm text-muted">Super admin override: any status. Cancelling an unfulfilled order returns its items to stock.</p>
            <form action={forceOrderStatusAction} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="back" value={here} />
              <Select name="status" defaultValue={order.status} aria-label="Order status">{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
              <Button variant="secondary">Update</Button>
            </form>
          </Card>
          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="font-semibold">Payment</h2>
            <p className="text-sm text-muted">Method: <span className="font-semibold uppercase text-ink">{order.payment.method}</span>. Changing the status here does not move money; record what happened at the gateway.</p>
            <form action={setOrderPaymentAction} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="back" value={here} />
              <Select name="payment" defaultValue={order.payment.status} aria-label="Payment status">{Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
              <Button variant="secondary">Update</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
