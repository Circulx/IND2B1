import "server-only";
import mongoose from "mongoose";
import { APPS } from "../catalog";
import { listPlans } from "./plans";
import { connectDb } from "../db/connect";
import {
  AppReviewModel, AuditLogModel, CartModel, CounterModel, CustomerModel, DiscountModel, MediaModel, OrderModel, ProductModel, QuoteRequestModel, SessionModel,
  PlanModel, StoreModel, SubscriberModel, UserModel,
} from "../db/models";
import { removeImage } from "../media/storage";
import type { Order, OrderStatus, PaymentStatus, Product, Store, StoreCategory } from "../types";
import { countActiveSuperAdmins } from "./users";

/**
 * Platform-wide data access for the super admin control centre (/superadmin).
 * Unlike the merchant services, these functions work ACROSS stores, so they must
 * only ever be called after requireSuperAdminPortal() (src/lib/superadmin.ts).
 */

type Raw = Record<string, unknown> & { _id: unknown };
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : typeof d === "string" ? d : new Date(0).toISOString());
const rx = (q: string) => new RegExp(q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
export const PAGE_SIZE = 50;

/** Store name and subdomain for a set of store ids (for cross-store lists). */
export async function storeNames(ids: string[]) {
  await connectDb();
  const unique = [...new Set(ids.map(String))];
  if (!unique.length) return new Map<string, { name: string; slug: string }>();
  const rows = await StoreModel.find({ _id: { $in: unique } }, { name: 1, slug: 1 }).lean();
  return new Map(rows.map((s) => [String(s._id), { name: s.name, slug: s.slug }]));
}

/** Name and email for a set of platform user ids. */
export async function userLabels(ids: string[]) {
  await connectDb();
  const unique = [...new Set(ids.map(String))];
  if (!unique.length) return new Map<string, { name: string; email: string }>();
  const rows = await UserModel.find({ _id: { $in: unique } }, { name: 1, email: 1 }).lean();
  return new Map(rows.map((u) => [String(u._id), { name: u.name, email: u.email }]));
}

/** Small store list for filter drop-downs. */
export async function storeOptions() {
  await connectDb();
  const rows = await StoreModel.find({}, { name: 1, slug: 1 }).sort({ name: 1 }).limit(1000).lean();
  return rows.map((s) => ({ id: String(s._id), name: s.name, slug: s.slug }));
}

/** Work waiting, for the navigation badges. */
export async function navCounts() {
  await connectDb();
  const [kyc, unfulfilled, reviews] = await Promise.all([
    StoreModel.countDocuments({ kyc: "pending" }),
    OrderModel.countDocuments({ status: "unfulfilled" }),
    AppReviewModel.find({}, { status: 1 }).lean(),
  ]);
  const override = new Map(reviews.map((r) => [String(r._id), r.status]));
  const plugins = APPS.filter((a) => (override.get(a.id) ?? a.status) === "in_review").length;
  return { kyc, unfulfilled, plugins };
}

/* ================================================================ overview */
export async function platformOverview() {
  await connectDb();
  const day = 864e5;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const since = new Date(start.getTime() - 13 * day);
  const now = new Date();
  const [merchants, admins, superadmins, disabledUsers, shoppers, devices, stores, recentOrders, unfulfilled, allOrders] = await Promise.all([
    UserModel.countDocuments({ role: "merchant" }),
    UserModel.countDocuments({ role: "admin" }),
    UserModel.countDocuments({ role: "superadmin" }),
    UserModel.countDocuments({ status: "disabled" }),
    CustomerModel.countDocuments({}),
    SessionModel.countDocuments({ expiresAt: { $gt: now }, kind: { $ne: "customer" } }),
    StoreModel.find({}, { plan: 1, status: 1, kyc: 1, createdAt: 1 }).lean<Raw[]>(),
    OrderModel.find({}, { number: 1, storeId: 1, totalPaise: 1, status: 1, payment: 1, customer: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(8).lean<Raw[]>(),
    OrderModel.countDocuments({ status: "unfulfilled" }),
    OrderModel.find({ createdAt: { $gte: since } }, { totalPaise: 1, status: 1, createdAt: 1 }).lean<Raw[]>(),
  ]);

  const counted = (o: Raw) => o.status !== "cancelled" && o.status !== "returned";
  const days = Array.from({ length: 14 }, (_, i) => {
    const from = since.getTime() + i * day;
    const inDay = allOrders.filter((o) => { const t = new Date(o.createdAt as Date).getTime(); return t >= from && t < from + day; });
    return {
      label: new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      gmvPaise: inDay.filter(counted).reduce((a, o) => a + Number(o.totalPaise ?? 0), 0),
      orders: inDay.length,
      newStores: stores.filter((s) => { const t = new Date(s.createdAt as Date).getTime(); return t >= from && t < from + day; }).length,
    };
  });
  const plans = await listPlans();
  const mrrPaise = stores.filter((s) => s.status !== "suspended").reduce((a, s) => a + (plans.find((p) => p.id === s.plan)?.pricePaise ?? 0), 0);
  const names = await storeNames(recentOrders.map((o) => String(o.storeId)));
  return {
    users: { merchants, admins, superadmins, disabled: disabledUsers, shoppers, devices },
    stores: {
      total: stores.length,
      active: stores.filter((s) => s.status === "active").length,
      setup: stores.filter((s) => s.status === "setup").length,
      suspended: stores.filter((s) => s.status === "suspended").length,
      kycVerified: stores.filter((s) => s.kyc === "verified").length,
      byPlan: plans.map((p) => ({ id: p.id, name: p.name, stores: stores.filter((s) => s.plan === p.id).length })),
    },
    mrrPaise, unfulfilled, days,
    gmv14dPaise: days.reduce((a, d) => a + d.gmvPaise, 0),
    orders14d: days.reduce((a, d) => a + d.orders, 0),
    recentOrders: recentOrders.map((o) => ({
      id: String(o._id), number: Number(o.number), storeId: String(o.storeId), storeName: names.get(String(o.storeId))?.name ?? String(o.storeId),
      totalPaise: Number(o.totalPaise ?? 0), status: o.status as OrderStatus, payment: o.payment as Order["payment"],
      customer: String((o.customer as Order["customer"] | undefined)?.name ?? ""), createdAt: iso(o.createdAt),
    })),
  };
}

/* ================================================================ stores */
export async function updateStoreProfile(storeId: string, patch: { name: string; category: StoreCategory; email: string; phone: string; address: string; state: string; gstin: string }) {
  await connectDb();
  const $set: Record<string, unknown> = {
    name: patch.name, category: patch.category, "settings.email": patch.email, "settings.phone": patch.phone,
    "settings.address": patch.address, "settings.state": patch.state,
  };
  if (patch.gstin) $set["settings.gstin"] = patch.gstin;
  const res = await StoreModel.updateOne({ _id: String(storeId) }, patch.gstin ? { $set } : { $set, $unset: { "settings.gstin": 1 } });
  if (res.matchedCount === 0) throw new Error("not_found");
}

/** Moves a store to another merchant account. The new owner must be an active merchant. */
export async function transferStoreOwner(storeId: string, newOwnerEmail: string) {
  await connectDb();
  const owner = await UserModel.findOne({ email: newOwnerEmail.trim().toLowerCase() }).lean();
  if (!owner) throw new Error("owner_not_found");
  if (owner.role !== "merchant") throw new Error("owner_not_merchant");
  if ((owner.status ?? "active") === "disabled") throw new Error("owner_disabled");
  const store = await StoreModel.findById(String(storeId), { ownerId: 1 }).lean();
  if (!store) throw new Error("not_found");
  if (store.ownerId === owner._id) throw new Error("same_owner");
  await StoreModel.updateOne({ _id: store._id }, { $set: { ownerId: owner._id } });
  await MediaModel.updateMany({ storeId: store._id }, { $set: { ownerId: owner._id } });
  return { from: store.ownerId, to: owner._id, email: owner.email };
}

/**
 * Permanently deletes a store and everything that belongs to it: products, orders, discount
 * codes, shopper accounts (and their sessions), newsletter subscribers, quote requests,
 * uploaded images and KYC documents. Cannot be undone.
 */
export async function deleteStoreCascade(storeId: string) {
  await connectDb();
  const store = await StoreModel.findById(String(storeId)).lean();
  if (!store) throw new Error("not_found");
  const id = store._id;
  const customers = await CustomerModel.find({ storeId: id }, { _id: 1 }).lean();
  const media = await MediaModel.find({ storeId: id }).lean();
  const [products, orders, discounts, shoppers, subscribers, quotes] = await Promise.all([
    ProductModel.deleteMany({ storeId: id }), OrderModel.deleteMany({ storeId: id }), DiscountModel.deleteMany({ storeId: id }),
    CustomerModel.deleteMany({ storeId: id }), SubscriberModel.deleteMany({ storeId: id }), QuoteRequestModel.deleteMany({ storeId: id }),
  ]);
  if (customers.length) await SessionModel.deleteMany({ userId: { $in: customers.map((c) => c._id) } });
  await SessionModel.deleteMany({ kind: "customer", storeId: id });
  for (const m of media) await removeImage({ provider: m.provider, key: m.key }).catch(() => {});
  await MediaModel.deleteMany({ storeId: id });
  const db = mongoose.connection.db;
  if (db) {
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "kycdocs" });
    for (const d of store.kycDocs ?? []) if (/^[a-f0-9]{24}$/.test(d.fileId)) await bucket.delete(new mongoose.Types.ObjectId(d.fileId)).catch(() => {});
  }
  await CartModel.deleteMany({ storeId: id });
  await CounterModel.deleteOne({ _id: `order:${id}` });
  await StoreModel.deleteOne({ _id: id });
  return {
    name: store.name, slug: store.slug, products: products.deletedCount, orders: orders.deletedCount, discounts: discounts.deletedCount,
    shoppers: shoppers.deletedCount, subscribers: subscribers.deletedCount, quotes: quotes.deletedCount, images: media.length,
  };
}

export async function storeCounts(storeId: string) {
  await connectDb();
  const [products, orders, discounts, shoppers, subscribers, quotes] = await Promise.all([
    ProductModel.countDocuments({ storeId }), OrderModel.countDocuments({ storeId }), DiscountModel.countDocuments({ storeId }),
    CustomerModel.countDocuments({ storeId }), SubscriberModel.countDocuments({ storeId }), QuoteRequestModel.countDocuments({ storeId }),
  ]);
  return { products, orders, discounts, shoppers, subscribers, quotes };
}

/* ================================================================ orders (all stores) */
export type OrderRow = Order & { storeName: string; storeSlug: string };

export async function listAllOrders(f: { q?: string; status?: OrderStatus; payment?: PaymentStatus; storeId?: string; page?: number } = {}) {
  await connectDb();
  const query: Record<string, unknown> = {};
  if (f.status) query.status = f.status;
  if (f.payment) query["payment.status"] = f.payment;
  if (f.storeId) query.storeId = f.storeId;
  if (f.q?.trim()) {
    const r = rx(f.q);
    const or: Record<string, unknown>[] = [{ _id: r }, { "customer.email": r }, { "customer.name": r }, { "customer.phone": r }];
    if (/^\d{1,9}$/.test(f.q.trim())) or.push({ number: Number(f.q.trim()) });
    query.$or = or;
  }
  const page = Math.max(1, Math.min(10_000, Math.floor(f.page ?? 1)));
  const [rows, total] = await Promise.all([
    OrderModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean<Raw[]>(),
    OrderModel.countDocuments(query),
  ]);
  const names = await storeNames(rows.map((r) => String(r.storeId)));
  const orders: OrderRow[] = rows.map(({ _id, createdAt, ...rest }) => {
    const o = rest as unknown as Omit<Order, "id" | "createdAt">;
    return { ...o, id: String(_id), createdAt: iso(createdAt), storeName: names.get(o.storeId)?.name ?? o.storeId, storeSlug: names.get(o.storeId)?.slug ?? "" };
  });
  return { orders, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getAnyOrder(orderId: string) {
  await connectDb();
  const r = await OrderModel.findById(String(orderId)).lean<Raw | null>();
  if (!r) return undefined;
  const { _id, createdAt, ...rest } = r;
  return { ...(rest as unknown as Omit<Order, "id" | "createdAt">), id: String(_id), createdAt: iso(createdAt) } as Order;
}

/** Super admin override of an order's status (any status). Stock is returned when an unshipped order is cancelled. */
export async function forceOrderStatus(orderId: string, status: OrderStatus) {
  const order = await getAnyOrder(orderId);
  if (!order) throw new Error("not_found");
  if (order.status === status) return order;
  const res = await OrderModel.updateOne({ _id: order.id, status: order.status }, { $set: { status } });
  if (res.matchedCount === 0) throw new Error("status_changed");
  let restocked: boolean | undefined;
  if (status === "cancelled" && order.status === "unfulfilled") {
    restocked = true;
    for (const l of order.lines) {
      try {
        await ProductModel.updateOne({ _id: l.productId, storeId: order.storeId, "variants.id": l.variantId }, { $inc: { "variants.$.stock": l.qty } });
      } catch { restocked = false; }   // the status change stands; stock can be corrected by the merchant
    }
  }
  return { ...order, status, previous: order.status, restocked };
}

export async function setOrderPaymentStatus(orderId: string, status: PaymentStatus) {
  await connectDb();
  const res = await OrderModel.updateOne({ _id: String(orderId) }, { $set: { "payment.status": status } });
  if (res.matchedCount === 0) throw new Error("not_found");
}

/* ================================================================ products (all stores) */
export type ProductRow = Product & { storeName: string; storeSlug: string };

export async function listAllProducts(f: { q?: string; status?: "active" | "draft"; storeId?: string; page?: number } = {}) {
  await connectDb();
  const query: Record<string, unknown> = {};
  if (f.status) query.status = f.status;
  if (f.storeId) query.storeId = f.storeId;
  if (f.q?.trim()) { const r = rx(f.q); query.$or = [{ title: r }, { handle: r }, { _id: r }, { "variants.sku": r }]; }
  const page = Math.max(1, Math.min(10_000, Math.floor(f.page ?? 1)));
  const [rows, total] = await Promise.all([
    ProductModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean<Raw[]>(),
    ProductModel.countDocuments(query),
  ]);
  const names = await storeNames(rows.map((r) => String(r.storeId)));
  const products: ProductRow[] = rows.map(({ _id, createdAt, collectionHandle, ...rest }) => {
    const p = rest as unknown as Omit<Product, "id" | "createdAt" | "collection">;
    return { ...p, id: String(_id), createdAt: iso(createdAt), collection: String(collectionHandle ?? "all"), storeName: names.get(p.storeId)?.name ?? p.storeId, storeSlug: names.get(p.storeId)?.slug ?? "" };
  });
  return { products, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Owning store of a product (the super admin acts on products by id alone). */
export async function productStoreId(productId: string) {
  await connectDb();
  const p = await ProductModel.findById(String(productId), { storeId: 1 }).lean();
  return p ? p.storeId : undefined;
}

/* ================================================================ discount codes (all stores) */
export async function listAllDiscounts(f: { q?: string; storeId?: string } = {}) {
  await connectDb();
  const query: Record<string, unknown> = {};
  if (f.storeId) query.storeId = f.storeId;
  if (f.q?.trim()) query.code = rx(f.q);
  const rows = await DiscountModel.find(query).sort({ storeId: 1, code: 1 }).limit(1000).lean();
  const names = await storeNames(rows.map((r) => r.storeId));
  return rows.map((d) => ({
    storeId: d.storeId, storeName: names.get(d.storeId)?.name ?? d.storeId, code: d.code, type: d.type, value: d.value,
    minSubtotalPaise: d.minSubtotalPaise ?? 0, active: d.active, uses: d.uses ?? 0,
  }));
}

/* ================================================================ accounts */
/** Edits a platform account's name, phone and email (email must stay unique). */
export async function updateUserAccount(userId: string, patch: { name: string; phone: string; email: string }) {
  await connectDb();
  const email = patch.email.trim().toLowerCase();
  const u = await UserModel.findById(String(userId)).lean();
  if (!u) throw new Error("not_found");
  if (email !== u.email && (await UserModel.exists({ email, _id: { $ne: u._id } }))) throw new Error("email_taken");
  try {
    await UserModel.updateOne({ _id: u._id }, { $set: { name: patch.name.trim(), phone: patch.phone.trim(), email } });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new Error("email_taken");
    throw e;
  }
  if (email !== u.email) await SessionModel.deleteMany({ userId: u._id });   // tokens carry the old email
  return { before: { name: u.name, email: u.email, phone: u.phone }, after: { name: patch.name.trim(), email, phone: patch.phone.trim() } };
}

/**
 * Deletes a platform account. Merchants who still own stores must have their stores
 * transferred or deleted first; the last active super admin can never be deleted.
 */
export async function deleteUserAccount(userId: string) {
  await connectDb();
  const u = await UserModel.findById(String(userId)).lean();
  if (!u) throw new Error("not_found");
  if (await StoreModel.exists({ ownerId: u._id })) throw new Error("owns_stores");
  if (u.role === "superadmin" && (u.status ?? "active") === "active" && (await countActiveSuperAdmins()) <= 1) throw new Error("last_superadmin");
  await SessionModel.deleteMany({ userId: u._id });
  await UserModel.deleteOne({ _id: u._id });
  return { email: u.email, role: u.role };
}

export async function deleteCustomerAccount(customerId: string) {
  await connectDb();
  const c = await CustomerModel.findById(String(customerId)).lean();
  if (!c) throw new Error("not_found");
  await SessionModel.deleteMany({ userId: c._id });
  await CustomerModel.deleteOne({ _id: c._id });
  return { email: c.email, storeId: c.storeId };
}

export async function signOutCustomerEverywhere(customerId: string) {
  await connectDb();
  await SessionModel.deleteMany({ userId: String(customerId), kind: "customer" });
}

/* ================================================================ sessions */
export async function listActiveSessionsAll(kind: "platform" | "customer" = "platform", limit = 500) {
  await connectDb();
  const rows = await SessionModel.find({ expiresAt: { $gt: new Date() }, ...(kind === "customer" ? { kind: "customer" } : { kind: { $ne: "customer" } }) })
    .sort({ lastSeenAt: -1 }).limit(limit).lean();
  const ids = [...new Set(rows.map((r) => r.userId))];
  const [users, customers] = await Promise.all([
    kind === "platform" ? UserModel.find({ _id: { $in: ids } }, { name: 1, email: 1 }).lean() : Promise.resolve([]),
    kind === "customer" ? CustomerModel.find({ _id: { $in: ids } }, { name: 1, email: 1 }).lean() : Promise.resolve([]),
  ]);
  const who = new Map<string, { name: string; email: string }>([...users, ...customers].map((u) => [String(u._id), { name: u.name, email: u.email }]));
  const stores = kind === "customer" ? await storeNames(rows.map((r) => String(r.storeId ?? ""))) : new Map<string, { name: string; slug: string }>();
  return rows.map((r) => ({
    sid: r._id, userId: r.userId, role: String(r.role), name: who.get(r.userId)?.name ?? "Deleted account", email: who.get(r.userId)?.email ?? "",
    storeName: r.storeId ? stores.get(r.storeId)?.name ?? r.storeId : "", ip: r.ip ?? "", userAgent: r.userAgent ?? "",
    createdAt: r.createdAt.toISOString(), lastSeenAt: r.lastSeenAt.toISOString(),
  }));
}

/** Emergency sign-out of a whole group. The super admin's own device is always kept. */
export async function revokeSessionsByScope(scope: "merchants" | "staff" | "shoppers" | "everyone", keepSid: string) {
  await connectDb();
  const filter =
    scope === "shoppers" ? { kind: "customer" }
    : scope === "merchants" ? { kind: { $ne: "customer" }, role: "merchant" }
    : scope === "staff" ? { kind: { $ne: "customer" }, role: { $in: ["admin", "superadmin"] } }
    : {};
  const res = await SessionModel.deleteMany({ ...filter, _id: { $ne: keepSid } });
  return res.deletedCount;
}

export async function revokeAnySession(sid: string) {
  await connectDb();
  await SessionModel.deleteOne({ _id: String(sid) });
}

/* ================================================================ system */
export async function collectionCounts() {
  await connectDb();
  const models = [UserModel, StoreModel, ProductModel, OrderModel, DiscountModel, CustomerModel, CartModel, PlanModel, SessionModel, AuditLogModel, MediaModel, SubscriberModel, QuoteRequestModel] as const;
  return Promise.all(models.map(async (M) => [M.collection.collectionName, await (M as unknown as mongoose.Model<unknown>).countDocuments({})] as [string, number]));
}

export type { Store };
