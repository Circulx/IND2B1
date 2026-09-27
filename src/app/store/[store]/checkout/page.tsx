import type { Metadata } from "next";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { cartTotals } from "@/lib/services";
import { formatINR } from "@/components/ui";
import { INDIAN_STATES, cartLines, currentDiscount, resolveStore } from "@/lib/storefront";
import { placeOrder } from "@/actions/storefront";
import { CheckoutForm } from "@/components/storefront/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ store: string }> }) {
  const slug = (await params).store;
  const { store, base } = await resolveStore(slug);
  const lines = await cartLines(store);
  if (lines.length === 0) redirect(`${base}/cart`);
  const disc = await currentDiscount(store.id);
  const t = cartTotals(lines.map((l) => ({ product: l.product, variant: l.variant, qty: l.item.qty })), store.settings, { b2b: store.installedApps.includes("b2b-wholesale"), discount: disc?.discount });
  return (
    <div className="grid gap-10 px-5 py-10 md:px-10 lg:grid-cols-[1fr_380px]">
      <div className="max-w-2xl">
        <h1 className="mb-6 text-3xl font-semibold" style={{ fontFamily: "var(--store-font)" }}>Checkout</h1>
        <CheckoutForm token={randomBytes(18).toString("base64url")} action={placeOrder.bind(null, slug)} online={store.installedApps.includes("razorpay")} cod={store.installedApps.includes("cod")} states={INDIAN_STATES} totalLabel={formatINR(t.totalPaise)} />
      </div>
      <aside className="flex flex-col gap-3 self-start rounded-card border border-line bg-white p-6 text-sm">
        <h2 className="text-lg font-semibold">{lines.length} item{lines.length > 1 ? "s" : ""}</h2>
        {lines.map((l) => <div key={l.variant.id} className="flex justify-between gap-3"><span>{l.product.title} · {l.variant.title} × {l.item.qty}</span></div>)}
        <div className="flex justify-between border-t border-line pt-3"><span className="text-muted">Subtotal</span><span className="font-mono">{formatINR(t.subtotalPaise)}</span></div>
        {t.discountPaise > 0 && <div className="flex justify-between text-ok"><span>Discount</span><span className="font-mono">−{formatINR(t.discountPaise)}</span></div>}
        <div className="flex justify-between"><span className="text-muted">Shipping</span><span className="font-mono">{t.shippingPaise ? formatINR(t.shippingPaise) : "Free"}</span></div>
        <div className="flex justify-between"><span className="text-muted">{t.taxLabel}</span><span className="font-mono">{formatINR(t.taxPaise)}</span></div>
        <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><span>Total</span><span className="font-mono">{formatINR(t.totalPaise)}</span></div>
      </aside>
    </div>
  );
}
