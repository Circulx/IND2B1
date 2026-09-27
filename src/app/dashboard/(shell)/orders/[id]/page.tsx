import { notFound } from "next/navigation";
import { ORDER_STATUS, PAYMENT_STATUS, getOrder, type OrderStatus } from "@/lib/services";
import { Button, Card, Icon, Img, PageHeader, StatusPill, formatINR } from "@/components/ui";
import { requireStore } from "@/lib/merchant";
import { setOrderStatus } from "@/actions/dashboard";

export const metadata = { title: "Order" };

const ACTIONS: Record<OrderStatus, { to: OrderStatus; label: string; variant: "primary" | "secondary" | "danger" }[]> = {
  unfulfilled: [{ to: "fulfilled", label: "Mark as fulfilled", variant: "primary" }, { to: "cancelled", label: "Cancel order", variant: "danger" }],
  fulfilled: [{ to: "delivered", label: "Mark as delivered", variant: "primary" }, { to: "returned", label: "Mark as returned", variant: "secondary" }],
  delivered: [{ to: "returned", label: "Mark as returned", variant: "secondary" }],
  cancelled: [], returned: [],
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store } = await requireStore();
  const o = await getOrder(store.id, id);
  if (!o) notFound();
  const sameState = o.customer.state === store.settings.state;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={<a href="/dashboard/orders" className="text-teal-700">← Orders</a>}
        title={<span className="flex flex-wrap items-center gap-3">Order #{o.number}
          <StatusPill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusPill>
          <StatusPill tone={PAYMENT_STATUS[o.payment.status].tone}>{PAYMENT_STATUS[o.payment.status].label}</StatusPill></span>}
        subtitle={new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        actions={ACTIONS[o.status].map((a) => (
          <form key={a.to} action={setOrderStatus.bind(null, o.id, o.status, a.to)}><Button variant={a.variant}>{a.label}</Button></form>
        ))} />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Items</h2>
            <ul className="flex flex-col divide-y divide-line-soft">
              {o.lines.map((l) => (
                <li key={l.variantId} className="flex items-center gap-3.5 py-3">
                  <Img src={l.imageUrl} alt={l.title} className="size-14 shrink-0" />
                  <div className="flex-1"><div className="font-medium">{l.title}</div><div className="text-xs text-muted">{l.variantTitle}</div></div>
                  <div className="font-mono text-sm tabular text-muted">{formatINR(l.unitPricePaise)} × {l.qty}</div>
                  <div className="w-28 text-right font-mono text-sm font-semibold tabular">{formatINR(l.unitPricePaise * l.qty)}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Payment</h2>
            <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
              <dt className="text-muted">Subtotal</dt><dd className="font-mono tabular">{formatINR(o.subtotalPaise)}</dd>
              {o.discountPaise > 0 && <><dt className="text-muted">Discount {o.discountCode && <span className="font-mono">({o.discountCode})</span>}</dt><dd className="font-mono tabular text-ok">−{formatINR(o.discountPaise)}</dd></>}
              <dt className="text-muted">Shipping</dt><dd className="font-mono tabular">{o.shippingPaise ? formatINR(o.shippingPaise) : "Free"}</dd>
              <dt className="text-muted">{sameState ? "CGST + SGST" : "IGST"} {store.settings.pricesIncludeGst ? "(included)" : ""}</dt><dd className="font-mono tabular">{formatINR(o.taxPaise)}</dd>
              <dt className="border-t border-line pt-2 font-semibold">Total</dt><dd className="border-t border-line pt-2 font-mono font-semibold tabular">{formatINR(o.totalPaise)}</dd>
            </dl>
            <p className="mt-3 text-xs capitalize text-muted">Paid by {o.payment.method === "cod" ? "cash on delivery" : o.payment.method}</p>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-1.5 p-5 text-sm">
            <h2 className="mb-1.5 font-semibold">Customer</h2>
            <span className="font-medium">{o.customer.name}</span>
            <a href={`mailto:${o.customer.email}`} className="text-teal-700">{o.customer.email}</a>
            <span className="font-mono">{o.customer.phone}</span>
          </Card>
          <Card className="flex flex-col gap-1 p-5 text-sm">
            <h2 className="mb-1.5 font-semibold">Ship to</h2>
            <span>{o.customer.name}</span><span>{o.customer.address}</span><span>{o.customer.city} {o.customer.pincode}</span><span>{o.customer.state}</span>
          </Card>
          {store.installedApps.includes("shiprocket") && o.status === "unfulfilled" && (
            <Card className="flex items-start gap-3 p-5 text-sm"><Icon name="truck" className="mt-0.5 text-teal-700" />
              <div><div className="font-semibold">Shiprocket</div><p className="text-muted">Mark as fulfilled to book a pickup and send tracking to the customer.</p></div></Card>
          )}
        </div>
      </div>
    </div>
  );
}
