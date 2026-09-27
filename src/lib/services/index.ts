import "server-only";
import { APPS, PLANS, TEMPLATES } from "../catalog";
import { connectDb } from "../db/connect";
import {
  type StoreDoc, AppReviewModel, CounterModel, DiscountModel, OrderModel, ProductModel, QuoteRequestModel, StoreModel, SubscriberModel,
} from "../db/models";
import type {
  AppDef, Customer, Discount, Order, OrderStatus, Product, QuoteRequest, Section, Store, StoreCategory, Subscriber, Theme,
} from "../types";

export * from "../types";
export { APPS, PLANS, TEMPLATES } from "../catalog";
export { cartTotals, unitPrice } from "../pricing";
export * from "./users";
export * from "./sessions";

/**
 * Data access for the whole app, on MongoDB (Mongoose).
 * Callers pass a storeId they have already authorised (see requireStore in
 * src/lib/merchant.ts); every store-owned query filters on it.
 * The comment next to each function is the REST endpoint it maps to if you
 * later expose these as an API.
 */

/* ---------------------------------------------------------------- mapping helpers */
type Raw = Record<string, unknown> & { _id: unknown };
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : typeof d === "string" ? d : new Date().toISOString());

function toStore(r: Raw | null): Store | undefined {
  if (!r) return undefined;
  const { _id, createdAt, draftTheme, customDomain, logo, ...rest } = r;
  return {
    ...(rest as Omit<Store, "id" | "createdAt">), id: String(_id), createdAt: iso(createdAt),
    draftTheme: (draftTheme as Theme | null) ?? undefined,
    customDomain: (customDomain as Store["customDomain"] | null) ?? undefined,
    logo: (logo as Store["logo"] | null) ?? undefined,
  };
}
function toProduct(r: Raw | null): Product | undefined {
  if (!r) return undefined;
  const { _id, createdAt, collectionHandle, tiers, ...rest } = r;
  return {
    ...(rest as Omit<Product, "id" | "createdAt" | "collection">), id: String(_id), createdAt: iso(createdAt),
    collection: String(collectionHandle ?? "all"), tiers: (tiers as Product["tiers"]) ?? undefined,
  };
}
function toOrder(r: Raw | null): Order | undefined {
  if (!r) return undefined;
  const { _id, createdAt, ...rest } = r;
  return { ...(rest as Omit<Order, "id" | "createdAt">), id: String(_id), createdAt: iso(createdAt) };
}
function toDiscount(r: Raw): Discount {
  const { code, type, value, minSubtotalPaise, active, uses } = r as unknown as Discount;
  return { code, type, value, minSubtotalPaise, active, uses };
}

export const themeFromTemplate = (templateId: string, version = 1): Theme => {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0]!;
  return { templateId: t.id, version, tokens: { ...t.tokens }, sections: structuredClone(t.sections) };
};

/* ================================================================ platform catalog */
export const listTemplates = async () => TEMPLATES;                                   // GET /themes/templates
export const getTemplate = async (id: string) => TEMPLATES.find((t) => t.id === id);
export const listPlans = async () => PLANS;                                           // GET /billing/plans

async function appsWithStatus(): Promise<AppDef[]> {
  await connectDb();
  const reviews = await AppReviewModel.find().lean();
  const o = new Map(reviews.map((r) => [r._id, r.status as AppDef["status"]]));
  return APPS.map((a) => ({ ...a, status: o.get(a.id) ?? a.status }));
}
export const listApps = async (opts: { includeInReview?: boolean } = {}) =>          // GET /apps
  (await appsWithStatus()).filter((a) => opts.includeInReview || a.status === "published");
export const getApp = async (id: string) => (await appsWithStatus()).find((a) => a.id === id);
export async function setAppStatus(appId: string, status: AppDef["status"], note?: string) {   // POST /apps/{id}/review
  if (!APPS.some((a) => a.id === appId)) throw new Error("unknown_app");
  await connectDb();
  await AppReviewModel.updateOne({ _id: appId }, { $set: { status, note, updatedAt: new Date() } }, { upsert: true });
}

/* ================================================================ stores */
const RESERVED = new Set(["www", "api", "admin", "dashboard", "app", "auth", "cdn", "img", "mail", "help", "status", "store", "shop", "ind2b", "login", "signup", "start"]);

/** Subdomain rules: 3–30 chars, lowercase letters, digits and hyphens, not reserved. */
export function normaliseSlug(input: string) {
  return input.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
}

export async function isSlugAvailable(slug: string) {                                  // GET /stores/availability?slug=
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(slug) || RESERVED.has(slug)) return false;
  await connectDb();
  return !(await StoreModel.exists({ slug }));
}

export async function getStoreBySlug(slug: string) {                                  // GET /stores/by-slug/{slug}
  await connectDb();
  return toStore(await StoreModel.findOne({ slug }).lean<Raw | null>());
}
export async function getStoreByDomain(host: string) {                                // GET /domains/{host}
  await connectDb();
  return toStore(await StoreModel.findOne({ "customDomain.host": host.toLowerCase(), "customDomain.status": "verified" }).lean<Raw | null>());
}
export async function isDomainTaken(host: string, exceptStoreId: string) {
  await connectDb();
  return !!(await StoreModel.exists({ "customDomain.host": String(host).toLowerCase(), _id: { $ne: exceptStoreId } }));
}
export async function getStore(id: string) {
  await connectDb();
  return toStore(await StoreModel.findById(id).lean<Raw | null>());
}
export async function listStoresForOwner(ownerId: string) {
  await connectDb();
  return (await StoreModel.find({ ownerId }).sort({ createdAt: 1 }).lean<Raw[]>()).map((r) => toStore(r)!);
}
export async function listAllStores() {                                               // admin
  await connectDb();
  return (await StoreModel.find().sort({ createdAt: -1 }).lean<Raw[]>()).map((r) => toStore(r)!);
}

export async function createStore(input: { ownerId: string; name: string; slug: string; category: StoreCategory; templateId: string; email: string }) {  // POST /stores
  if (!(await isSlugAvailable(input.slug))) throw new Error("slug_taken");
  const template = TEMPLATES.find((t) => t.id === input.templateId) ?? TEMPLATES[0]!;
  const installedApps = ["razorpay", "cod", "gst-invoice", ...(input.category === "b2b" ? ["b2b-wholesale"] : [])];
  const doc: StoreDoc = {
    _id: `st_${input.slug}`, slug: input.slug, name: input.name, ownerId: input.ownerId, category: input.category, plan: "starter", status: "setup",
    templateId: template.id, theme: themeFromTemplate(template.id), installedApps, kyc: "not_started", createdAt: new Date(), draftTheme: null, customDomain: null,
    settings: { email: input.email, phone: "", address: "", state: "Maharashtra", currency: "INR", pricesIncludeGst: input.category !== "b2b", shipping: { flatRatePaise: 7900, freeAbovePaise: 99900 }, payments: { razorpay: true, cod: true, upi: true } },
  };
  try {
    await StoreModel.create(doc);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new Error("slug_taken");   // lost a race for the same name
    throw e;
  }
  await CounterModel.updateOne({ _id: `order:${doc._id}` }, { $setOnInsert: { seq: 1000 } }, { upsert: true });
  return (await getStore(doc._id))!;
}

export async function updateStore(storeId: string, patch: Partial<Pick<Store, "name" | "status" | "plan" | "kyc" | "kycNote" | "customDomain" | "logo">> & { settings?: Partial<Store["settings"]> }) {  // PATCH /stores/{id}
  await connectDb();
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "settings") continue;
    if (v === undefined) { if (k === "customDomain" || k === "logo") $set[k] = null; } else $set[k] = v;
  }
  for (const [k, v] of Object.entries(patch.settings ?? {})) {
    if (v === undefined) $unset[`settings.${k}`] = 1; else $set[`settings.${k}`] = v;
  }
  const res = await StoreModel.updateOne({ _id: storeId }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) });
  if (res.matchedCount === 0) throw new Error("not_found");
  return (await getStore(storeId))!;
}

/* ---------------- plugins per store: POST/DELETE /stores/{id}/apps/{appId} */
export async function installApp(storeId: string, appId: string) {
  const app = await getApp(appId);
  if (!app || app.status !== "published") throw new Error("unknown_app");
  await StoreModel.updateOne({ _id: storeId }, { $addToSet: { installedApps: appId } });
  return (await getStore(storeId))!;
}
export async function uninstallApp(storeId: string, appId: string) {
  await connectDb();
  const store = await getStore(storeId);
  if (!store) throw new Error("not_found");
  // Remove sections that only this app provides from the published theme and the draft.
  const owned = new Set(APPS.find((a) => a.id === appId)?.sections ?? []);
  const strip = (t?: Theme) => (t ? { ...t, sections: t.sections.filter((s) => !owned.has(s.type)) } : null);
  await StoreModel.updateOne({ _id: storeId }, {
    $set: { installedApps: store.installedApps.filter((a) => a !== appId), theme: strip(store.theme), draftTheme: strip(store.draftTheme) },
  });
  return (await getStore(storeId))!;
}

/* ---------------- themes */
export async function saveDraftTheme(storeId: string, sections: Section[], tokens?: Theme["tokens"]) {   // PUT /stores/{id}/theme/draft
  const s = await getStore(storeId);
  if (!s) throw new Error("not_found");
  const base = s.draftTheme ?? s.theme;
  const draftTheme: Theme = { ...base, sections, tokens: tokens ?? base.tokens };
  await StoreModel.updateOne({ _id: storeId }, { $set: { draftTheme } });
  return draftTheme;
}
export async function publishTheme(storeId: string) {                                                   // POST /stores/{id}/theme/publish
  const s = await getStore(storeId);
  if (!s) throw new Error("not_found");
  const theme: Theme = { ...(s.draftTheme ?? s.theme), version: s.theme.version + 1 };
  await StoreModel.updateOne({ _id: storeId }, { $set: { theme, draftTheme: null, ...(s.status === "setup" ? { status: "active" } : {}) } });
  return theme;
}
export async function applyTemplate(storeId: string, templateId: string) {                               // POST /stores/{id}/theme/apply-template
  const s = await getStore(storeId);
  if (!s) throw new Error("not_found");
  const draftTheme = { ...themeFromTemplate(templateId), version: s.theme.version };
  await StoreModel.updateOne({ _id: storeId }, { $set: { templateId, draftTheme } });
  return draftTheme;
}

/* ================================================================ catalog */
export async function listProducts(storeId: string, opts: { activeOnly?: boolean } = {}) {               // GET /stores/{id}/products
  await connectDb();
  const q: Record<string, unknown> = { storeId };
  if (opts.activeOnly) q.status = "active";
  return (await ProductModel.find(q).sort({ createdAt: 1 }).lean<Raw[]>()).map((r) => toProduct(r)!);
}
export async function getProductByHandle(storeId: string, handle: string) {
  await connectDb();
  return toProduct(await ProductModel.findOne({ storeId, handle }).lean<Raw | null>());
}
export async function getProduct(storeId: string, id: string) {
  await connectDb();
  return toProduct(await ProductModel.findOne({ _id: id, storeId }).lean<Raw | null>());
}
export async function listCollections(storeId: string) {
  const handles = [...new Set((await listProducts(storeId, { activeOnly: true })).map((p) => p.collection))];
  return handles.map((h) => ({ handle: h, title: h.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }));
}

export async function upsertProduct(storeId: string, input: Omit<Product, "id" | "storeId" | "createdAt" | "handle"> & { id?: string }) {  // POST|PUT /stores/{id}/products
  await connectDb();
  const { id, collection, ...fields } = input;
  const data = { ...fields, collectionHandle: collection };
  if (id) {
    const res = await ProductModel.updateOne({ _id: id, storeId }, { $set: data });
    if (res.matchedCount) return (await getProduct(storeId, id))!;
  }
  let handle = normaliseSlug(input.title) || "product";
  while (await ProductModel.exists({ storeId, handle })) handle += "-1";
  const _id = `pr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await ProductModel.create({ ...data, _id, storeId, handle, createdAt: new Date() });
  return (await getProduct(storeId, _id))!;
}

/** Deletes a product. Past orders keep their own copy of titles and prices. */
export async function deleteProduct(storeId: string, id: string) {
  await connectDb();
  const p = await ProductModel.findOneAndDelete({ _id: String(id), storeId }).lean();
  return p ? (p.images ?? []).map((i) => i.id) : [];
}

/* ================================================================ orders */
export async function listOrders(storeId: string) {                                                     // GET /stores/{id}/orders
  await connectDb();
  return (await OrderModel.find({ storeId }).sort({ createdAt: -1 }).lean<Raw[]>()).map((r) => toOrder(r)!);
}
export async function countOrders(storeId: string, status?: OrderStatus) {
  await connectDb();
  return OrderModel.countDocuments(status ? { storeId, status } : { storeId });
}
export async function getOrder(storeId: string, id: string) {
  await connectDb();
  return toOrder(await OrderModel.findOne({ _id: id, storeId }).lean<Raw | null>());
}

/**
 * Checkout. Stock is reserved line by line with a conditional update (only if
 * enough stock is left); if any line fails, earlier reservations are released.
 * Works on a standalone MongoDB (no multi-document transaction needed).
 */
export async function createOrder(storeId: string, input: Omit<Order, "id" | "number" | "storeId" | "createdAt" | "status">) {  // POST /stores/{id}/checkout
  await connectDb();
  // Idempotency: the same checkout form submitted twice returns the first order.
  if (input.checkoutToken) {
    const existing = await OrderModel.findOne({ storeId, checkoutToken: input.checkoutToken }).lean<Raw | null>();
    if (existing) return toOrder(existing)!;
  }
  const reserved: typeof input.lines = [];
  try {
    for (const l of input.lines) {
      const res = await ProductModel.updateOne(
        { _id: l.productId, storeId, variants: { $elemMatch: { id: l.variantId, stock: { $gte: l.qty } } } },
        { $inc: { "variants.$.stock": -l.qty } },
      );
      if (res.modifiedCount !== 1) throw new Error(`out_of_stock:${l.title}`);
      reserved.push(l);
    }
    const counter = await CounterModel.findOneAndUpdate({ _id: `order:${storeId}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }).lean();
    const number = Math.max(1001, counter!.seq);
    const _id = `ord_${storeId}_${number}`;
    await OrderModel.create({ ...input, _id, number, storeId, createdAt: new Date(), status: "unfulfilled" });
    if (input.discountCode) await DiscountModel.updateOne({ storeId, code: input.discountCode }, { $inc: { uses: 1 } });
    return (await getOrder(storeId, _id))!;
  } catch (e) {
    await releaseStock(storeId, reserved);
    if ((e as { code?: number }).code === 11000 && input.checkoutToken) {
      const existing = await OrderModel.findOne({ storeId, checkoutToken: input.checkoutToken }).lean<Raw | null>();
      if (existing) return toOrder(existing)!;
    }
    throw e;
  }
}

async function releaseStock(storeId: string, lines: { productId: string; variantId: string; qty: number }[]) {
  for (const l of lines) {
    await ProductModel.updateOne({ _id: l.productId, storeId, "variants.id": l.variantId }, { $inc: { "variants.$.stock": l.qty } });
  }
}

/** Moves an order to a new status. Only valid transitions from the current status are applied (atomically). */
export async function updateOrderStatus(storeId: string, orderId: string, from: OrderStatus, status: OrderStatus) {       // PATCH /stores/{id}/orders/{orderId}
  await connectDb();
  const res = await OrderModel.updateOne({ _id: orderId, storeId, status: from }, { $set: { status } });
  if (res.matchedCount === 0) throw new Error("status_changed");
  const order = (await getOrder(storeId, orderId))!;
  // A cancelled (never shipped) order puts its items back in stock.
  if (status === "cancelled" && from === "unfulfilled") await releaseStock(storeId, order.lines);
  return order;
}

export async function listCustomers(storeId: string): Promise<Customer[]> {                             // GET /stores/{id}/customers
  const map = new Map<string, Customer>();
  for (const o of await listOrders(storeId)) {
    const c = map.get(o.customer.email) ?? { email: o.customer.email, name: o.customer.name, phone: o.customer.phone, city: o.customer.city, orders: 0, spentPaise: 0 };
    c.orders += 1;
    if (o.status !== "cancelled" && o.status !== "returned") c.spentPaise += o.totalPaise;
    map.set(c.email, c);
  }
  return [...map.values()].sort((a, b) => b.spentPaise - a.spentPaise);
}

/* ---------------- discounts */
export async function listDiscounts(storeId: string) {                                                  // GET /stores/{id}/discounts
  await connectDb();
  return (await DiscountModel.find({ storeId }).sort({ _id: 1 }).lean<Raw[]>()).map(toDiscount);
}
export async function findDiscount(storeId: string, code: string) {
  await connectDb();
  const r = await DiscountModel.findOne({ storeId, code: code.trim().toUpperCase() }).lean<Raw | null>();
  return r ? toDiscount(r) : undefined;
}
export async function createDiscount(storeId: string, d: Omit<Discount, "uses">) {
  await connectDb();
  if (await DiscountModel.exists({ storeId, code: d.code })) throw new Error("code_exists");
  await DiscountModel.create({ ...d, storeId, uses: 0 });
}
export async function toggleDiscount(storeId: string, code: string) {
  const d = await findDiscount(storeId, code);
  if (d) await DiscountModel.updateOne({ storeId, code: d.code }, { $set: { active: !d.active } });
}
export async function deleteDiscount(storeId: string, code: string) {
  await connectDb();
  await DiscountModel.deleteOne({ storeId, code: String(code).toUpperCase() });
}

/* ---------------- storefront forms */
export async function addSubscriber(storeId: string, email: string) {
  await connectDb();
  await SubscriberModel.updateOne({ storeId, email: email.toLowerCase() }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
}
export async function addQuoteRequest(storeId: string, q: { product: string; quantity: string; gstin?: string; phone: string }) {
  await connectDb();
  await QuoteRequestModel.create({ _id: `rfq_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, storeId, ...q, status: "new", createdAt: new Date() });
}
export async function countQuoteRequests(storeId: string, status?: QuoteRequest["status"]) {
  await connectDb();
  return QuoteRequestModel.countDocuments(status ? { storeId, status } : { storeId });
}
export async function listQuoteRequests(storeId: string): Promise<QuoteRequest[]> {
  await connectDb();
  const rows = await QuoteRequestModel.find({ storeId }).sort({ createdAt: -1 }).limit(500).lean();
  return rows.map((r) => ({ id: r._id, storeId: r.storeId, product: r.product, quantity: r.quantity, gstin: r.gstin || undefined, phone: r.phone, status: r.status, createdAt: r.createdAt.toISOString() }));
}
export async function setQuoteRequestStatus(storeId: string, id: string, status: QuoteRequest["status"]) {
  await connectDb();
  await QuoteRequestModel.updateOne({ _id: String(id), storeId }, { $set: { status } });
}
export async function listSubscribers(storeId: string): Promise<Subscriber[]> {
  await connectDb();
  const rows = await SubscriberModel.find({ storeId }).sort({ createdAt: -1 }).limit(5000).lean();
  return rows.map((r) => ({ email: r.email, createdAt: r.createdAt.toISOString() }));
}

/* ================================================================ analytics */
export async function storeStats(storeId: string) {                                                     // GET /stores/{id}/analytics/summary
  const orders = (await listOrders(storeId)).filter((o) => o.status !== "cancelled");
  const day = 864e5;
  const days = Array.from({ length: 14 }, (_, i) => {
    const start = new Date(Date.now() - (13 - i) * day); start.setHours(0, 0, 0, 0);
    const end = start.getTime() + day;
    return orders.filter((o) => { const t = Date.parse(o.createdAt); return t >= start.getTime() && t < end; }).reduce((a, o) => a + o.totalPaise, 0);
  });
  return {
    salesTodayPaise: days[days.length - 1] ?? 0, sales14dPaise: days.reduce((a, b) => a + b, 0), dailySalesPaise: days,
    orders: orders.length, toFulfil: orders.filter((o) => o.status === "unfulfilled").length,
    aovPaise: orders.length ? Math.round(orders.reduce((a, o) => a + o.totalPaise, 0) / orders.length) : 0,
  };
}

export async function platformStats() {                                                                 // GET /analytics/platform
  await connectDb();
  const [stores, orders, apps] = await Promise.all([
    StoreModel.find({}, { status: 1, kyc: 1, plan: 1 }).lean<Raw[]>(),
    OrderModel.find({}, { status: 1, totalPaise: 1 }).lean<Raw[]>(),
    appsWithStatus(),
  ]);
  const gmv = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned").reduce((a, o) => a + Number(o.totalPaise), 0);
  return {
    stores: stores.length, activeStores: stores.filter((s) => s.status === "active").length,
    kycPending: stores.filter((s) => s.kyc === "pending").length, gmvPaise: gmv, orders: orders.length,
    appsInReview: apps.filter((a) => a.status === "in_review").length,
    byPlan: PLANS.map((p) => ({ plan: p.name, stores: stores.filter((s) => s.plan === p.id).length })),
  };
}

/** Order totals per store for the admin list (one query instead of one per store). */
export async function gmvByStore() {
  await connectDb();
  const orders = await OrderModel.find({ status: { $nin: ["cancelled", "returned"] } }, { storeId: 1, totalPaise: 1 }).lean<Raw[]>();
  const m = new Map<string, number>();
  for (const o of orders) m.set(String(o.storeId), (m.get(String(o.storeId)) ?? 0) + Number(o.totalPaise));
  return m;
}

/** Admin overview: connection check and document counts. */
export async function databaseHealth() {
  const m = await connectDb();
  const t = Date.now();
  let ok = true;
  try { await m.connection.db!.admin().ping(); } catch { ok = false; }
  const pingMs = Date.now() - t;
  const { UserModel } = await import("../db/models");
  const counts = await Promise.all([UserModel, StoreModel, ProductModel, OrderModel, DiscountModel].map(async (M) => [M.collection.collectionName, await M.estimatedDocumentCount()] as [string, number]));
  return { ok, pingMs, name: m.connection.name, collections: counts };
}
