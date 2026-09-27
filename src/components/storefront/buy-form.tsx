"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatINR } from "@/components/ui";

export function BuyForm({ product, action, b2b }: { product: Product; action: (fd: FormData) => void; b2b: boolean }) {
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.stock > 0)?.id ?? product.variants[0]!.id);
  const [qty, setQty] = useState(1);
  const v = product.variants.find((x) => x.id === variantId)!;
  const tier = b2b ? [...(product.tiers ?? [])].sort((a, b) => b.minQty - a.minQty).find((t) => qty >= t.minQty) : undefined;
  const unit = tier ? Math.min(tier.pricePaise, v.pricePaise) : v.pricePaise;
  const off = v.compareAtPaise && v.compareAtPaise > v.pricePaise ? Math.round(((v.compareAtPaise - v.pricePaise) / v.compareAtPaise) * 100) : 0;
  const btn = { background: "var(--store-primary)", color: "var(--store-on-primary)", borderRadius: "var(--store-radius)" };

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="variantId" value={variantId} />
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold">{formatINR(unit)}</span>
        {off > 0 && !tier && <><span className="text-muted line-through">{formatINR(v.compareAtPaise!)}</span><span className="text-sm font-semibold" style={{ color: "var(--store-accent)" }}>{off}% off</span></>}
        {tier && <span className="text-sm font-semibold text-ok">Bulk price applied</span>}
      </div>
      {product.variants.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Size</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((x) => (
              <label key={x.id} className={`flex h-11 min-w-12 cursor-pointer items-center justify-center border px-3 text-sm ${x.stock <= 0 ? "opacity-40 line-through" : ""}`}
                style={{ borderRadius: "var(--store-radius)", borderColor: x.id === variantId ? "var(--store-primary)" : "#c3c9c0", borderWidth: x.id === variantId ? 2 : 1 }}>
                <input type="radio" name="variant" value={x.id} checked={x.id === variantId} disabled={x.stock <= 0} onChange={() => setVariantId(x.id)} className="sr-only" />{x.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {b2b && product.tiers?.length ? (
        <table className="w-full max-w-sm text-sm"><caption className="mb-1 text-left text-sm font-medium">Bulk pricing</caption><tbody>
          <tr className="border-b border-line-soft"><td className="py-1.5">1+</td><td className="py-1.5 text-right font-mono">{formatINR(v.pricePaise)}</td></tr>
          {product.tiers.map((t) => <tr key={t.minQty} className="border-b border-line-soft"><td className="py-1.5">{t.minQty}+</td><td className="py-1.5 text-right font-mono">{formatINR(t.pricePaise)}</td></tr>)}
        </tbody></table>
      ) : null}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qty" className="text-sm font-medium">Quantity</label>
          <input id="qty" name="qty" type="number" min={1} max={v.stock} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="h-12 w-24 rounded-control border border-control px-3 font-mono" />
        </div>
        <button disabled={v.stock <= 0} className="h-12 flex-1 font-semibold disabled:opacity-50" style={btn}>{v.stock <= 0 ? "Sold out" : "Add to cart"}</button>
      </div>
      <p className="text-sm text-muted">{v.stock > 0 && v.stock <= 5 ? `Only ${v.stock} left · ` : ""}Inclusive of all taxes · Ships in 2–4 days</p>
    </form>
  );
}
