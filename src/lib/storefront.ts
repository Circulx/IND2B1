import "server-only";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { findDiscount, getProduct, getStoreByDomain, getStoreBySlug, listCollections, listProducts, type Product, type Store, type Variant } from "@/lib/services";
import type { SectionContext } from "@/components/sections";

/** Resolve the store for this request (subdomain, custom domain or /slug path). */
export async function resolveStore(param: string): Promise<{ store: Store; base: string }> {
  const h = await headers();
  const store = param === "_d" ? await getStoreByDomain(h.get("x-ind2b-domain") ?? "") : await getStoreBySlug(param);
  if (!store || store.status === "suspended") notFound();
  // On name.ind2b.com / custom domains links start at "/"; on ind2b.com/store/<slug> they carry the prefix.
  const base = h.has("x-ind2b-base") ? "" : `/store/${store.slug}`;
  return { store, base };
}

/**
 * Where to send the shopper after a form post: back to the page they came from
 * on this same host (never another site), or the store home.
 */
export function backTo(req: Request, base: string, query: Record<string, string>, hash?: string) {
  const here = new URL(req.url);
  let target = new URL(`${base}/`, here);
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const r = new URL(ref);
      if (r.host === (req.headers.get("host") ?? here.host)) target = new URL(r.pathname, here);
    } catch { /* ignore bad referer */ }
  }
  for (const [k, v] of Object.entries(query)) target.searchParams.set(k, v);
  if (hash) target.hash = hash;
  // Relative Location keeps the browser on the same host even behind a proxy.
  return target.pathname + target.search + target.hash;
}

/* ---------------- cart: one httpOnly cookie per store (product and variant ids + quantities). */
export type CartItem = { productId: string; variantId: string; qty: number };
const cartName = (storeId: string) => `cart_${storeId}`;

export async function readCart(storeId: string): Promise<CartItem[]> {
  const raw = (await cookies()).get(cartName(storeId))?.value;
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is CartItem => typeof x?.productId === "string" && typeof x?.variantId === "string" && Number.isInteger(x?.qty) && x.qty > 0).slice(0, 50) : [];
  } catch { return []; }
}
export async function writeCart(storeId: string, items: CartItem[]) {
  (await cookies()).set(cartName(storeId), JSON.stringify(items), { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30 });
}

export const discountCookie = (storeId: string) => `disc_${storeId}`;
export async function currentDiscount(storeId: string) {
  const code = (await cookies()).get(discountCookie(storeId))?.value;
  return code && /^[A-Z0-9]{3,30}$/.test(code) ? { code, discount: await findDiscount(storeId, code) } : null;
}

export type CartLine = { item: CartItem; product: Product; variant: Variant };
export async function cartLines(store: Store): Promise<CartLine[]> {
  const out: CartLine[] = [];
  for (const item of await readCart(store.id)) {
    const product = await getProduct(store.id, item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    if (product && variant && product.status === "active") out.push({ item, product, variant });
  }
  return out;
}

export async function sectionContext(store: Store, base: string): Promise<SectionContext> {
  const [products, collections, cart] = await Promise.all([listProducts(store.id, { activeOnly: true }), listCollections(store.id), readCart(store.id)]);
  return { store, products, collections, base, cartCount: cart.reduce((a, i) => a + i.qty, 0) };
}

export const INDIAN_STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
