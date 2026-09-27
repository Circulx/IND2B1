import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/services";
import { Icon, formatINR } from "@/components/ui";
import { resolveStore } from "@/lib/storefront";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

export default async function ThankYou({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store, base } = await resolveStore(slug);
  // Only the browser that placed the order may view it (customer accounts come later).
  if ((await cookies()).get(`last_order_${store.id}`)?.value !== id) notFound();
  const order = await getOrder(store.id, id);
  if (!order) notFound();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-14">
      <div className="flex items-center gap-3 text-ok"><Icon name="check-circle" size={32} /><h1 className="text-3xl font-semibold text-ink" style={{ fontFamily: "var(--store-font)" }}>Thank you, {order.customer.name.split(" ")[0]}!</h1></div>
      <p>Order <b>#{order.number}</b> is confirmed. We&apos;ve sent the details to {order.customer.email}{store.installedApps.includes("whatsapp-chat") ? " and WhatsApp" : ""}.</p>
      <div className="flex flex-col gap-2 rounded-card border border-line bg-white p-6 text-sm">
        {order.lines.map((l) => <div key={l.variantId} className="flex justify-between"><span>{l.title} · {l.variantTitle} × {l.qty}</span><span className="font-mono">{formatINR(l.unitPricePaise * l.qty)}</span></div>)}
        <div className="flex justify-between border-t border-line pt-3 font-semibold"><span>Total</span><span className="font-mono">{formatINR(order.totalPaise)}</span></div>
        <div className="text-muted">Payment: {order.payment.method === "cod" ? "Cash on delivery" : "Paid online"} · Delivering to {order.customer.city} {order.customer.pincode}</div>
      </div>
      <a href={`${base}/`} className="self-start font-semibold" style={{ color: "var(--store-primary)" }}>Continue shopping →</a>
    </div>
  );
}
