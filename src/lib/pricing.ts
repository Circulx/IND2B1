import type { Discount, Product, StoreSettings, Variant } from "./types";

/** Unit price after B2B volume tiers (only when the store has the B2B Wholesale app). */
export function unitPrice(product: Product, variant: Variant, qty: number, b2b: boolean) {
  if (!b2b || !product.tiers?.length) return variant.pricePaise;
  const tier = [...product.tiers].sort((a, b) => b.minQty - a.minQty).find((t) => qty >= t.minQty);
  return tier ? Math.min(tier.pricePaise, variant.pricePaise) : variant.pricePaise;
}

export type CartLineInput = { product: Product; variant: Variant; qty: number };
export type Totals = {
  subtotalPaise: number; discountPaise: number; shippingPaise: number; taxPaise: number; totalPaise: number;
  taxLabel: string; discountError?: string;
};

/**
 * Checkout totals. Indian retail prices usually include GST (MRP), so by default
 * GST is shown as the included portion. B2B stores can price exclusive of GST.
 * Same state → CGST + SGST, different state → IGST. Always computed on the
 * server when the order is placed; client totals are never trusted.
 */
export function cartTotals(lines: CartLineInput[], settings: StoreSettings, opts: { b2b?: boolean; discount?: Discount; customerState?: string } = {}): Totals {
  const priced = lines.map((l) => ({ ...l, unit: unitPrice(l.product, l.variant, l.qty, !!opts.b2b) }));
  const subtotal = priced.reduce((a, l) => a + l.unit * l.qty, 0);

  let discount = 0;
  let discountError: string | undefined;
  const d = opts.discount;
  if (d) {
    if (!d.active) discountError = "This code has expired.";
    else if (subtotal < d.minSubtotalPaise) discountError = `Add items worth ₹${Math.ceil((d.minSubtotalPaise - subtotal) / 100)} more to use this code.`;
    else discount = d.type === "percent" ? Math.round((subtotal * d.value) / 100) : Math.min(d.value, subtotal);
  }

  const afterDiscount = subtotal - discount;
  const { flatRatePaise, freeAbovePaise } = settings.shipping;
  const shipping = lines.length === 0 ? 0 : freeAbovePaise !== null && afterDiscount >= freeAbovePaise ? 0 : flatRatePaise;

  // GST per line on the discounted value, proportionally.
  const ratio = subtotal > 0 ? afterDiscount / subtotal : 0;
  const tax = Math.round(priced.reduce((a, l) => {
    const value = l.unit * l.qty * ratio;
    const rate = l.product.gstRate / 100;
    return a + (settings.pricesIncludeGst ? value - value / (1 + rate) : value * rate);
  }, 0));

  const interState = !!opts.customerState && opts.customerState !== settings.state;
  const taxLabel = `${settings.pricesIncludeGst ? "Includes " : ""}${interState ? "IGST" : "CGST + SGST"}`;
  const total = afterDiscount + shipping + (settings.pricesIncludeGst ? 0 : tax);
  return { subtotalPaise: subtotal, discountPaise: discount, shippingPaise: shipping, taxPaise: tax, totalPaise: total, taxLabel, discountError };
}
