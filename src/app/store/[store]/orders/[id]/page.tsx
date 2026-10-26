import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ORDER_STATUS, getOrder } from "@/lib/services";
import { Icon, formatINR } from "@/components/ui";
import { resolveStore } from "@/lib/storefront";
import { getCustomerSession } from "@/lib/auth/customer";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default async function ThankYou({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store, base } = await resolveStore(slug);
  // Visible to the browser that just placed the order, or to the signed-in shopper who owns it.
  const [jar, me] = await Promise.all([cookies(), getCustomerSession(store.id)]);
  const order = await getOrder(store.id, id);
  if (!order) notFound();
  const justPlaced = jar.get(`last_order_${store.id}`)?.value === id;
  if (!justPlaced && !(me && order.customerId === me.customerId)) notFound();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-14">
      <div className="flex items-center gap-3 text-ok"><Icon name="check-circle" size={32} /><h1 className="text-3xl font-semibold text-ink" style={{ fontFamily: "var(--store-font)" }}>{justPlaced ? `Thank you, ${order.customer.name.split(" ")[0]}!` : `Order #${order.number}`}</h1></div>
      {justPlaced
        ? <p>Order <b>#{order.number}</b> is confirmed. We&apos;ve sent the details to {order.customer.email}{store.installedApps.includes("whatsapp-chat") ? " and WhatsApp" : ""}.</p>
        : <p>Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · <b>{ORDER_STATUS[order.status].label}</b></p>}
      <div className="flex flex-col gap-2 rounded-card border border-line bg-white p-6 text-sm">
        {order.lines.map((l) => <div key={l.variantId} className="flex justify-between"><span>{l.title} · {l.variantTitle} × {l.qty}</span><span className="font-mono">{formatINR(l.unitPricePaise * l.qty)}</span></div>)}
        <div className="flex justify-between border-t border-line pt-3 font-semibold"><span>Total</span><span className="font-mono">{formatINR(order.totalPaise)}</span></div>
        <div className="text-muted">Payment: {order.payment.method === "cod" ? "Cash on delivery" : "Paid online"} · Delivering to {order.customer.city} {order.customer.pincode}</div>
      </div>
      <div className="flex flex-wrap gap-6">
        <a href={`${base}/`} className="font-semibold" style={{ color: "var(--store-primary)" }}>Continue shopping →</a>
        {me ? <a href={`${base}/account`} className="font-semibold" style={{ color: "var(--store-primary)" }}>Your orders</a>
          : <a href={`${base}/account/register`} className="text-sm text-muted underline">Create an account to track future orders</a>}
      </div>
    </div>
  );
}
