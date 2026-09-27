import mongoose, { Schema, type Model } from "mongoose";
import type { Discount, ImageRef, Order, Product, Store, Theme } from "../../types";

/**
 * MongoDB collections. Ids are readable strings (st_…, pr_…, ord_…) so they can
 * appear in URLs and logs. Every store-owned document carries storeId and every
 * query filters on it (tenant isolation).
 */

const opts = { versionKey: false } as const;
// `mongoose.models.X ??` reuses the compiled model when Next.js hot-reloads this file.

/* ---------------------------------------------------------------- users */
export type UserDoc = { _id: string; email: string; name: string; phone: string; passwordHash: string; role: "merchant" | "admin"; createdAt: Date; passwordChangedAt?: Date };
const UserSchema = new Schema<UserDoc>({
  _id: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  phone: { type: String, default: "" },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["merchant", "admin"], required: true },
  createdAt: { type: Date, default: () => new Date() },
  passwordChangedAt: Date,
}, opts);
UserSchema.index({ email: 1 }, { unique: true });
export const UserModel = (mongoose.models.User as Model<UserDoc> | undefined) ?? mongoose.model<UserDoc>("User", UserSchema);

/* ---------------------------------------------------------------- stores */
const SettingsSchema = new Schema({
  email: String, phone: String, address: String, state: String, gstin: String,
  currency: { type: String, default: "INR" },
  pricesIncludeGst: { type: Boolean, default: true },
  shipping: { flatRatePaise: { type: Number, default: 0 }, freeAbovePaise: { type: Number, default: null } },
  payments: { razorpay: { type: Boolean, default: true }, cod: { type: Boolean, default: true }, upi: { type: Boolean, default: true } },
}, { _id: false });

export type StoreDoc = Omit<Store, "id" | "createdAt" | "draftTheme" | "customDomain" | "logo"> & {
  _id: string; createdAt: Date; draftTheme: Theme | null; customDomain: Store["customDomain"] | null; logo?: ImageRef | null;
};
const StoreSchema = new Schema<StoreDoc>({
  _id: { type: String, required: true },
  slug: { type: String, required: true },
  name: { type: String, required: true },
  ownerId: { type: String, required: true },
  category: { type: String, required: true },
  plan: { type: String, enum: ["starter", "grow", "pro"], default: "starter" },
  status: { type: String, enum: ["active", "setup", "suspended"], default: "setup" },
  templateId: { type: String, required: true },
  theme: { type: Schema.Types.Mixed, required: true },          // published theme: tokens + sections
  draftTheme: { type: Schema.Types.Mixed, default: null },       // page-builder draft
  customDomain: { type: new Schema({ host: String, status: { type: String, enum: ["pending", "verified"] } }, { _id: false }), default: null },
  installedApps: { type: [String], default: [] },
  settings: { type: SettingsSchema, required: true },
  kyc: { type: String, enum: ["not_started", "pending", "verified", "rejected"], default: "not_started" },
  kycNote: String,
  kycDocs: { type: [new Schema({ fileId: String, kind: { type: String, enum: ["pan", "bank", "gst"] }, filename: String, contentType: String, size: Number, uploadedAt: String }, { _id: false })], default: [] },
  logo: { type: new Schema({ id: String, url: String, alt: String, width: Number, height: Number }, { _id: false }), default: null },
  createdAt: { type: Date, default: () => new Date() },
}, { ...opts, minimize: false });
StoreSchema.index({ slug: 1 }, { unique: true });
StoreSchema.index({ ownerId: 1 });
StoreSchema.index({ "customDomain.host": 1 }, { sparse: true });
export const StoreModel = (mongoose.models.Store as Model<StoreDoc> | undefined) ?? mongoose.model<StoreDoc>("Store", StoreSchema);

/* ---------------------------------------------------------------- catalog */
const VariantSchema = new Schema({
  id: { type: String, required: true }, title: String, sku: String,
  pricePaise: { type: Number, required: true }, compareAtPaise: Number, stock: { type: Number, default: 0 },
}, { _id: false });
export type ProductDoc = Omit<Product, "id" | "createdAt" | "collection"> & { _id: string; createdAt: Date; collectionHandle: string };
const ProductSchema = new Schema<ProductDoc>({
  _id: { type: String, required: true },
  storeId: { type: String, required: true },
  handle: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  status: { type: String, enum: ["active", "draft"], default: "active" },
  collectionHandle: { type: String, default: "all" },   // exposed as product.collection ("collection" is reserved in Mongoose)
  tags: { type: [String], default: [] },
  images: { type: [new Schema({ id: String, url: String, alt: String, width: Number, height: Number }, { _id: false })], default: [] },
  variants: { type: [VariantSchema], default: [] },
  gstRate: { type: Number, default: 5 },
  hsn: String,
  tiers: { type: [new Schema({ minQty: Number, pricePaise: Number }, { _id: false })], default: undefined },
  createdAt: { type: Date, default: () => new Date() },
}, opts);
ProductSchema.index({ storeId: 1, handle: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, status: 1 });
export const ProductModel = (mongoose.models.Product as Model<ProductDoc> | undefined) ?? mongoose.model<ProductDoc>("Product", ProductSchema);

/* ---------------------------------------------------------------- commerce */
export type OrderDoc = Omit<Order, "id" | "createdAt"> & { _id: string; createdAt: Date };
const OrderSchema = new Schema<OrderDoc>({
  _id: { type: String, required: true },
  number: { type: Number, required: true },
  storeId: { type: String, required: true },
  customer: { name: String, email: String, phone: String, address: String, city: String, pincode: String, state: String },
  lines: [new Schema({ productId: String, variantId: String, title: String, variantTitle: String, qty: Number, unitPricePaise: Number, imageUrl: String }, { _id: false })],
  subtotalPaise: Number, shippingPaise: Number, discountPaise: Number, taxPaise: Number, totalPaise: Number,
  payment: { method: { type: String, enum: ["upi", "card", "netbanking", "cod"] }, status: { type: String, enum: ["paid", "pending", "cod", "refunded"] } },
  status: { type: String, enum: ["unfulfilled", "fulfilled", "delivered", "cancelled", "returned"], default: "unfulfilled" },
  discountCode: String,
  checkoutToken: String,
  createdAt: { type: Date, default: () => new Date() },
}, opts);
OrderSchema.index({ storeId: 1, checkoutToken: 1 }, { unique: true, partialFilterExpression: { checkoutToken: { $type: "string" } } });
OrderSchema.index({ storeId: 1, createdAt: -1 });
OrderSchema.index({ storeId: 1, number: 1 }, { unique: true });
export const OrderModel = (mongoose.models.Order as Model<OrderDoc> | undefined) ?? mongoose.model<OrderDoc>("Order", OrderSchema);

export type DiscountDoc = Discount & { storeId: string };
const DiscountSchema = new Schema<DiscountDoc>({
  storeId: { type: String, required: true },
  code: { type: String, required: true },
  type: { type: String, enum: ["percent", "fixed"], required: true },
  value: { type: Number, required: true },
  minSubtotalPaise: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  uses: { type: Number, default: 0 },
}, opts);
DiscountSchema.index({ storeId: 1, code: 1 }, { unique: true });
export const DiscountModel = (mongoose.models.Discount as Model<DiscountDoc> | undefined) ?? mongoose.model<DiscountDoc>("Discount", DiscountSchema);

/** Sequential order numbers per store (#1001, #1002…). */
type CounterDoc = { _id: string; seq: number };
export const CounterModel = (mongoose.models.Counter as Model<CounterDoc> | undefined) ?? mongoose.model<CounterDoc>("Counter", new Schema<CounterDoc>({ _id: String, seq: { type: Number, default: 0 } }, opts));

/* ---------------------------------------------------------------- platform */
/** Plugin review decisions (overrides the catalog's default status). */
type AppReviewDoc = { _id: string; status: string; note?: string; updatedAt: Date };
export const AppReviewModel = (mongoose.models.AppReview as Model<AppReviewDoc> | undefined) ?? mongoose.model<AppReviewDoc>("AppReview",
  new Schema<AppReviewDoc>({ _id: String, status: String, note: String, updatedAt: { type: Date, default: () => new Date() } }, opts));

export type AuditDoc = { at: Date; actorId: string; actorName: string; action: string; target: string; detail?: unknown };
export const AuditLogModel = (mongoose.models.AuditLog as Model<AuditDoc> | undefined) ?? mongoose.model<AuditDoc>("AuditLog", new Schema<AuditDoc>({
  at: { type: Date, default: () => new Date() }, actorId: String, actorName: String, action: String, target: String, detail: Schema.Types.Mixed,
}, opts));

export type SubscriberDoc = { storeId: string; email: string; createdAt: Date };
const SubscriberSchema = new Schema<SubscriberDoc>({
  storeId: { type: String, required: true }, email: { type: String, required: true }, createdAt: { type: Date, default: () => new Date() },
}, opts);
SubscriberSchema.index({ storeId: 1, email: 1 }, { unique: true });
export const SubscriberModel = (mongoose.models.Subscriber as Model<SubscriberDoc> | undefined) ?? mongoose.model<SubscriberDoc>("Subscriber", SubscriberSchema);

export type QuoteRequestDoc = { _id: string; storeId: string; product: string; quantity: string; gstin?: string; phone: string; status: "new" | "contacted" | "won" | "lost"; createdAt: Date };
export const QuoteRequestModel = (mongoose.models.QuoteRequest as Model<QuoteRequestDoc> | undefined) ?? mongoose.model<QuoteRequestDoc>("QuoteRequest", new Schema<QuoteRequestDoc>({
  _id: { type: String, required: true }, storeId: { type: String, required: true, index: true }, product: String, quantity: String, gstin: String, phone: String,
  status: { type: String, enum: ["new", "contacted", "won", "lost"], default: "new" }, createdAt: { type: Date, default: () => new Date() },
}, opts));

/** Marks one-time jobs such as the demo seed. */
type MetaDoc = { _id: string; at: Date };
export const MetaModel = (mongoose.models.Meta as Model<MetaDoc> | undefined) ?? mongoose.model<MetaDoc>("Meta", new Schema<MetaDoc>({ _id: String, at: { type: Date, default: () => new Date() } }, opts));

/* ---------------------------------------------------------------- security */
/** Server-side login sessions. Deleting a document signs that device out. Expired ones are removed by MongoDB (TTL index). */
export type SessionDoc = { _id: string; userId: string; role: "merchant" | "admin"; createdAt: Date; lastSeenAt: Date; expiresAt: Date; ip?: string; userAgent?: string };
const SessionSchema = new Schema<SessionDoc>({
  _id: { type: String, required: true }, userId: { type: String, required: true, index: true }, role: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() }, lastSeenAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true }, ip: String, userAgent: String,
}, opts);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const SessionModel = (mongoose.models.Session as Model<SessionDoc> | undefined) ?? mongoose.model<SessionDoc>("Session", SessionSchema);

/** Fixed-window request counters for rate limiting (shared by all app instances). */
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };
const RateLimitSchema = new Schema<RateLimitDoc>({ _id: String, count: { type: Number, default: 0 }, expiresAt: { type: Date, required: true } }, opts);
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RateLimitModel = (mongoose.models.RateLimit as Model<RateLimitDoc> | undefined) ?? mongoose.model<RateLimitDoc>("RateLimit", RateLimitSchema);

/* ---------------------------------------------------------------- media */
/** Every uploaded image. Pages only ever show URLs that exist here, for the right store. */
export type MediaDoc = {
  _id: string; storeId: string; ownerId: string; purpose: "product" | "logo" | "section"; provider: "cloudinary" | "local";
  key: string; url: string; width: number; height: number; bytes: number; format: string; alt?: string; createdAt: Date;
};
const MediaSchema = new Schema<MediaDoc>({
  _id: { type: String, required: true }, storeId: { type: String, required: true }, ownerId: { type: String, required: true },
  purpose: { type: String, enum: ["product", "logo", "section"], required: true }, provider: { type: String, enum: ["cloudinary", "local"], required: true },
  key: { type: String, required: true }, url: { type: String, required: true }, width: Number, height: Number, bytes: Number, format: String, alt: String,
  createdAt: { type: Date, default: () => new Date() },
}, opts);
MediaSchema.index({ storeId: 1, createdAt: -1 });
MediaSchema.index({ url: 1 });
export const MediaModel = (mongoose.models.Media as Model<MediaDoc> | undefined) ?? mongoose.model<MediaDoc>("Media", MediaSchema);
