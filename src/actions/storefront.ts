"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cartTotals, createOrder, getProduct, unitPrice } from "@/lib/services";
import { cartLines, currentDiscount, discountCookie, readCart, resolveStore, writeCart } from "@/lib/storefront";
import { ipFrom, rateLimit } from "@/lib/security";



export async function addToCart(storeParam: string, formData: FormData) {
  const { store, base } = await resolveStore(storeParam);
  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  const qty = Math.max(1, Math.min(999, Math.floor(Number(formData.get("qty")) || 1)));
  const product = await getProduct(store.id, productId);
  const variant = product?.variants.find((v) => v.id === variantId);
  if (!product || !variant || product.status !== "active") return;
  const cart = await readCart(store.id);
  const existing = cart.find((i) => i.variantId === variantId);
  const nextQty = Math.min((existing?.qty ?? 0) + qty, variant.stock);
  if (nextQty <= 0) redirect(`${base}/products/${product.handle}?soldout=1`);
  await writeCart(store.id, [...cart.filter((i) => i.variantId !== variantId), { productId, variantId, qty: nextQty }]);
  redirect(`${base}/cart`);
}

export async function updateCartLine(storeParam: string, variantId: string, qty: number) {
  const { store } = await resolveStore(storeParam);
  const cart = await readCart(store.id);
  await writeCart(store.id, qty <= 0 ? cart.filter((i) => i.variantId !== variantId) : cart.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(qty, 999) } : i)));
}

export async function applyDiscount(storeParam: string, formData: FormData) {
  const { store, base } = await resolveStore(storeParam);
  const code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 30);
  const jar = await cookies();
  if (!code) jar.delete(discountCookie(store.id));
  else jar.set(discountCookie(store.id), code, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 });
  redirect(`${base}/cart`);
}


const checkoutSchema = z.object({
  email: z.string().email("Enter a valid email."),
  phone: z.string().regex(/^(\+91[\s-]?)?[6-9]\d{4}\s?\d{5}$/, "Enter a 10-digit Indian mobile number."),
  name: z.string().trim().min(2, "Enter your full name."),
  address: z.string().trim().min(8, "Enter your full address."),
  city: z.string().trim().min(2, "Enter your city."),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode."),
  state: z.string().min(2, "Choose your state."),
  payment: z.enum(["upi", "card", "netbanking", "cod"]),
});
export type CheckoutState = { errors?: Record<string, string>; values?: Record<string, string> };

/**
 * Places the order. Online payment is simulated as successful: connect Razorpay
 * (create a Razorpay order here, open Razorpay Checkout in the browser, mark the
 * order paid from the verified webhook) before taking real payments.
 */
export async function placeOrder(storeParam: string, _prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const { store, base } = await resolveStore(storeParam);
  const limit = await rateLimit(`checkout:${store.id}:${ipFrom(await headers())}`, 20, 10 * 60);
  if (!limit.ok) return { errors: { form: "Too many attempts. Please wait a few minutes and try again." } };
  const checkoutToken = String(formData.get("checkoutToken") ?? "");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(checkoutToken)) return { errors: { form: "Your checkout session expired. Refresh the page and try again." } };
  const values = Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v).slice(0, 300)]));
  const parsed = checkoutSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { errors, values };
  }
  const d = parsed.data;
  if (d.payment === "cod" && !store.installedApps.includes("cod")) return { errors: { payment: "Cash on delivery is not available." }, values };
  if (d.payment !== "cod" && !store.installedApps.includes("razorpay")) return { errors: { payment: "Online payment is not available." }, values };

  const lines = await cartLines(store);
  if (lines.length === 0) redirect(`${base}/cart`);
  const disc = await currentDiscount(store.id);
  const t = cartTotals(lines.map((l) => ({ product: l.product, variant: l.variant, qty: l.item.qty })), store.settings,
    { b2b: store.installedApps.includes("b2b-wholesale"), discount: disc?.discount, customerState: d.state });

  let order;
  try {
    order = await createOrder(store.id, {
      customer: { name: d.name, email: d.email, phone: d.phone, address: d.address, city: d.city, pincode: d.pincode, state: d.state },
      lines: lines.map((l) => ({ productId: l.product.id, variantId: l.variant.id, title: l.product.title, variantTitle: l.variant.title, qty: l.item.qty, unitPricePaise: unitPrice(l.product, l.variant, l.item.qty, store.installedApps.includes("b2b-wholesale")), imageUrl: l.product.images[0]?.url })),
      subtotalPaise: t.subtotalPaise, shippingPaise: t.shippingPaise, discountPaise: t.discountPaise, taxPaise: t.taxPaise, totalPaise: t.totalPaise,
      payment: { method: d.payment, status: d.payment === "cod" ? "cod" : "paid" },
      discountCode: t.discountPaise > 0 ? disc?.code : undefined,
      checkoutToken,
    });
  } catch (e) {
    const msg = e instanceof Error && e.message.startsWith("out_of_stock:") ? `${e.message.slice(13)} just sold out. Update your cart.` : "We couldn't place the order. Please try again.";
    return { errors: { form: msg }, values };
  }
  await writeCart(store.id, []);
  const jar = await cookies();
  jar.delete(discountCookie(store.id));
  jar.set(`last_order_${store.id}`, order.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 });
  redirect(`${base}/orders/${order.id}`);
}
