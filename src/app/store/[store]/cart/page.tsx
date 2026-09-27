import type { Metadata } from "next";
import { cartTotals, unitPrice } from "@/lib/services";
import { Img, formatINR } from "@/components/ui";
import { cartLines, currentDiscount, resolveStore } from "@/lib/storefront";
import { applyDiscount, updateCartLine } from "@/actions/storefront";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage({ params }: { params: Promise<{ store: string }> }) {
  const slug = (await params).store;
  const { store, base } = await resolveStore(slug);
  const lines = await cartLines(store);
  const disc = await currentDiscount(store.id);
  const b2b = store.installedApps.includes("b2b-wholesale");
  const t = cartTotals(lines.map((l) => ({ product: l.product, variant: l.variant, qty: l.item.qty })), store.settings, { b2b, discount: disc?.discount });
  const btn = { background: "var(--store-primary)", color: "var(--store-on-primary)", borderRadius: "var(--store-radius)" };

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-5 py-24 text-center">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--store-font)" }}>Your cart is empty</h1>
        <a href={`${base}/collections/all`} className="inline-flex h-12 items-center px-7 font-semibold" style={btn}>Continue shopping</a>
      </div>
    );
  }
  return (
    <div className="grid gap-10 px-5 py-10 md:px-10 lg:grid-cols-[1fr_380px]">
      <section className="flex flex-col gap-2">
        <h1 className="mb-4 text-3xl font-semibold" style={{ fontFamily: "var(--store-font)" }}>Your cart</h1>
        {lines.map((l) => {
          const unit = unitPrice(l.product, l.variant, l.item.qty, b2b);
          return (
            <div key={l.variant.id} className="flex items-center gap-4 border-b border-line-soft py-4">
              <Img src={l.product.images[0]?.url} alt={l.product.title} className="size-20 shrink-0" />
              <div className="flex-1">
                <a href={`${base}/products/${l.product.handle}`} className="font-medium">{l.product.title}</a>
                <div className="text-sm text-muted">{l.variant.title} · {formatINR(unit)}</div>
              </div>
              <form className="flex items-center overflow-hidden rounded-control border border-control">
                <button formAction={updateCartLine.bind(null, slug, l.variant.id, l.item.qty - 1)} aria-label={`Decrease ${l.product.title}`} className="flex size-10 items-center justify-center">−</button>
                <span className="w-10 text-center font-mono" aria-live="polite">{l.item.qty}</span>
                <button formAction={updateCartLine.bind(null, slug, l.variant.id, Math.min(l.item.qty + 1, l.variant.stock))} aria-label={`Increase ${l.product.title}`} className="flex size-10 items-center justify-center">+</button>
              </form>
              <span className="w-24 text-right font-mono">{formatINR(unit * l.item.qty)}</span>
              <form><button formAction={updateCartLine.bind(null, slug, l.variant.id, 0)} className="text-sm text-muted underline">Remove</button></form>
            </div>
          );
        })}
      </section>
      <aside className="flex flex-col gap-4 self-start rounded-card border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <form action={applyDiscount.bind(null, slug)} className="flex gap-2">
          <label htmlFor="code" className="sr-only">Discount code</label>
          <input id="code" name="code" defaultValue={disc?.code} placeholder="Discount code" className="h-11 flex-1 rounded-control border border-control px-3 uppercase" />
          <button className="h-11 rounded-control border border-control px-4 text-sm font-semibold">Apply</button>
        </form>
        {disc && !disc.discount && <p className="text-sm text-bad">That code isn&apos;t valid for this store.</p>}
        {t.discountError && <p className="text-sm text-bad">{t.discountError}</p>}
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-mono">{formatINR(t.subtotalPaise)}</dd></div>
          {t.discountPaise > 0 && <div className="flex justify-between text-ok"><dt>Discount ({disc?.code})</dt><dd className="font-mono">−{formatINR(t.discountPaise)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd className="font-mono">{t.shippingPaise ? formatINR(t.shippingPaise) : "Free"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{t.taxLabel}</dt><dd className="font-mono">{formatINR(t.taxPaise)}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd className="font-mono">{formatINR(t.totalPaise)}</dd></div>
        </dl>
        <a href={`${base}/checkout`} className="flex h-12 items-center justify-center font-semibold" style={btn}>Checkout</a>
      </aside>
    </div>
  );
}
