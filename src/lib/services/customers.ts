import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { connectDb } from "../db/connect";
import { CustomerModel, OrderModel, StoreModel, type CustomerDoc } from "../db/models";
import type { CustomerAccount, Order, UserStatus } from "../types";
import { revokeUserSessions } from "./sessions";

/**
 * Shopper accounts. Each store has its own set: the same email can register
 * separately on two stores, and a shopper signed in to one store is a stranger
 * to every other store. Every query filters on storeId.
 */

const COST = 12;
const toCustomer = (r: Pick<CustomerDoc, "_id" | "storeId" | "email" | "name" | "phone" | "status" | "createdAt" | "lastLoginAt">): CustomerAccount => ({
  id: r._id, storeId: r.storeId, email: r.email, name: r.name, phone: r.phone ?? "", status: r.status ?? "active",
  createdAt: r.createdAt.toISOString(), ...(r.lastLoginAt ? { lastLoginAt: r.lastLoginAt.toISOString() } : {}),
});

let dummyHash: string | undefined;

export async function createCustomer(storeId: string, input: { email: string; name: string; phone: string; emailVerified?: boolean } & ({ password: string } | { passwordHash: string })) {
  await connectDb();
  const email = input.email.trim().toLowerCase();
  if (await CustomerModel.exists({ storeId, email })) throw new Error("email_taken");
  const doc: CustomerDoc = {
    _id: `cus_${randomBytes(9).toString("base64url")}`, storeId, email, name: input.name.trim(), phone: input.phone.trim(),
    passwordHash: "passwordHash" in input ? input.passwordHash : await bcrypt.hash(input.password, COST), status: "active", createdAt: new Date(),
    ...(input.emailVerified ? { emailVerifiedAt: new Date() } : {}),
  };
  try {
    await CustomerModel.create(doc);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new Error("email_taken");
    throw e;
  }
  return toCustomer(doc);
}

/** The shopper when email and password match on THIS store, otherwise null (same answer for every failure). */
export async function verifyCustomerLogin(storeId: string, email: string, password: string) {
  await connectDb();
  const r = await CustomerModel.findOne({ storeId, email: String(email).trim().toLowerCase() }).lean();
  const ok = await bcrypt.compare(String(password), r?.passwordHash ?? (dummyHash ??= bcrypt.hashSync("not-a-real-password", COST)));
  if (!r || !ok) return null;
  await CustomerModel.updateOne({ _id: r._id }, { $set: { lastLoginAt: new Date() } });
  return toCustomer(r);
}

export async function getCustomerAccount(storeId: string, id: string) {
  await connectDb();
  const r = await CustomerModel.findOne({ _id: String(id), storeId: String(storeId) }).lean();
  return r ? toCustomer(r) : undefined;
}

export async function updateCustomerProfile(storeId: string, id: string, patch: { name: string; phone: string }) {
  await connectDb();
  await CustomerModel.updateOne({ _id: String(id), storeId }, { $set: { name: patch.name.trim(), phone: patch.phone.trim() } });
}

/** Returns false when the current password is wrong. */
export async function changeCustomerPassword(storeId: string, id: string, current: string, next: string) {
  await connectDb();
  const r = await CustomerModel.findOne({ _id: String(id), storeId }).lean();
  if (!r || !(await bcrypt.compare(current, r.passwordHash))) return false;
  await CustomerModel.updateOne({ _id: r._id }, { $set: { passwordHash: await bcrypt.hash(next, COST), passwordChangedAt: new Date() } });
  return true;
}

/** Orders this shopper placed while signed in (newest first). */
export async function listCustomerOrders(storeId: string, customerId: string, limit = 50): Promise<Order[]> {
  await connectDb();
  const rows = await OrderModel.find({ storeId, customerId: String(customerId) }).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map(({ _id, createdAt, ...rest }) => ({ ...(rest as Omit<Order, "id" | "createdAt">), id: String(_id), createdAt: createdAt.toISOString() }));
}

/** Shopper accounts of one store (merchant dashboard → Customers). */
export async function listCustomerAccounts(storeId: string, limit = 500) {
  await connectDb();
  return (await CustomerModel.find({ storeId }).sort({ createdAt: -1 }).limit(limit).lean()).map(toCustomer);
}

/** Shopper accounts across all stores (super admin), with the store name. */
export async function listAllCustomerAccounts(filter: { q?: string; limit?: number } = {}) {
  await connectDb();
  const query: Record<string, unknown> = {};
  const q = filter.q?.trim().slice(0, 100);
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ email: rx }, { name: rx }, { storeId: rx }];
  }
  const rows = (await CustomerModel.find(query).sort({ createdAt: -1 }).limit(Math.min(filter.limit ?? 300, 1000)).lean()).map(toCustomer);
  const stores = await StoreModel.find({ _id: { $in: [...new Set(rows.map((r) => r.storeId))] } }, { name: 1, slug: 1 }).lean();
  const byId = new Map(stores.map((s) => [String(s._id), { name: s.name, slug: s.slug }]));
  return rows.map((r) => ({ ...r, storeName: byId.get(r.storeId)?.name ?? r.storeId, storeSlug: byId.get(r.storeId)?.slug ?? "" }));
}

export async function countCustomerAccounts() {
  await connectDb();
  return CustomerModel.estimatedDocumentCount();
}

/** Disables a shopper account (signs it out everywhere) or re-enables it. */
export async function setCustomerStatus(id: string, status: UserStatus) {
  await connectDb();
  const r = await CustomerModel.findById(String(id)).lean();
  if (!r) throw new Error("not_found");
  await CustomerModel.updateOne({ _id: r._id }, { $set: { status } });
  if (status === "disabled") await revokeUserSessions(r._id);
  return { ...toCustomer(r), status };
}

/** A shopper account on this store by email (password-reset flow). */
export async function getCustomerByEmail(storeId: string, email: string) {
  await connectDb();
  const r = await CustomerModel.findOne({ storeId, email: String(email).trim().toLowerCase() }, { passwordHash: 0 }).lean();
  return r ? toCustomer(r) : undefined;
}

/** Sets a new password (after a verified reset code) and signs the shopper out everywhere. */
export async function setCustomerPassword(storeId: string, id: string, password: string) {
  await connectDb();
  const res = await CustomerModel.updateOne({ _id: String(id), storeId }, { $set: { passwordHash: await bcrypt.hash(password, COST), passwordChangedAt: new Date() } });
  if (res.matchedCount === 0) throw new Error("not_found");
  await revokeUserSessions(String(id));
}
