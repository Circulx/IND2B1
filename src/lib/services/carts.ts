import "server-only";
import { randomBytes } from "node:crypto";
import { connectDb } from "../db/connect";
import { CartModel } from "../db/models";

/**
 * Shopping carts in MongoDB (collection "carts"). The browser keeps only the random cart id;
 * every read and write filters on storeId, so a cart id from one store means nothing on another.
 */
export type CartItem = { productId: string; variantId: string; qty: number };
export const CART_TTL_S = 60 * 60 * 24 * 30;
export const newCartId = () => `cart_${randomBytes(18).toString("base64url")}`;
export const isCartId = (v: unknown): v is string => typeof v === "string" && /^cart_[A-Za-z0-9_-]{20,40}$/.test(v);

const clean = (items: unknown): CartItem[] =>
  (Array.isArray(items) ? items : [])
    .filter((x): x is CartItem => typeof x?.productId === "string" && typeof x?.variantId === "string" && Number.isInteger(x?.qty) && x.qty > 0)
    .map((x) => ({ productId: x.productId, variantId: x.variantId, qty: Math.min(999, x.qty) }))
    .slice(0, 50);

export async function getCart(storeId: string, cartId: string) {
  if (!isCartId(cartId)) return null;
  await connectDb();
  const c = await CartModel.findOne({ _id: cartId, storeId, expiresAt: { $gt: new Date() } }).lean();
  return c ? { id: c._id, customerId: c.customerId, items: clean(c.items), discountCode: c.discountCode ?? null } : null;
}

/** The newest cart a signed-in shopper left on this store (on any device). */
export async function latestCustomerCart(storeId: string, customerId: string) {
  await connectDb();
  const c = await CartModel.findOne({ storeId, customerId: String(customerId), expiresAt: { $gt: new Date() } }).sort({ updatedAt: -1 }).lean();
  return c ? { id: c._id, customerId: c.customerId, items: clean(c.items), discountCode: c.discountCode ?? null } : null;
}

/** Creates or updates a cart. Pass customerId when a shopper is signed in so the cart follows them. */
export async function saveCart(storeId: string, cartId: string, patch: { items?: CartItem[]; discountCode?: string | null; customerId?: string }) {
  if (!isCartId(cartId)) throw new Error("invalid_cart");
  await connectDb();
  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now, expiresAt: new Date(now.getTime() + CART_TTL_S * 1000) };
  if (patch.items) $set.items = clean(patch.items);
  if (patch.discountCode !== undefined) $set.discountCode = patch.discountCode;
  if (patch.customerId) $set.customerId = patch.customerId;
  await CartModel.updateOne({ _id: cartId, storeId }, { $set, $setOnInsert: { createdAt: now, storeId } }, { upsert: true });
}

/** Removes the cart after an order is placed. */
export async function deleteCart(storeId: string, cartId: string) {
  if (!isCartId(cartId)) return;
  await connectDb();
  await CartModel.deleteOne({ _id: cartId, storeId });
}
