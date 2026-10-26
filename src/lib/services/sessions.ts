import "server-only";
import { randomBytes } from "node:crypto";
import { connectDb } from "../db/connect";
import { SessionModel, type SessionKind } from "../db/models";
import { CUSTOMER_SESSION_MAX_AGE_S, SESSION_MAX_AGE_S } from "../auth/session";
import type { Role } from "../types";

/**
 * Server-side sessions: one document per signed-in device.
 * Platform sessions (merchants, staff) and shopper sessions (one store) live in the
 * same collection and are told apart by `kind`; lookups always filter on it.
 */

type CreateOpts = { kind?: SessionKind; storeId?: string; maxAgeS?: number };

export async function createSession(userId: string, role: Role | "customer", meta: { ip?: string; userAgent?: string } = {}, opts: CreateOpts = {}) {
  await connectDb();
  const kind = opts.kind ?? "platform";
  const sid = randomBytes(32).toString("base64url");
  const now = new Date();
  const maxAgeS = opts.maxAgeS ?? (kind === "customer" ? CUSTOMER_SESSION_MAX_AGE_S : SESSION_MAX_AGE_S);
  await SessionModel.create({
    _id: sid, userId, role, kind, ...(opts.storeId ? { storeId: opts.storeId } : {}),
    createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + maxAgeS * 1000),
    ip: meta.ip?.slice(0, 64), userAgent: meta.userAgent?.slice(0, 300),
  });
  return sid;
}

/** Filter that matches only sessions of the given kind (legacy documents without `kind` are platform sessions). */
const kindFilter = (kind: SessionKind, storeId?: string) =>
  kind === "customer" ? { kind: "customer", storeId: String(storeId ?? "") } : { kind: { $ne: "customer" } };

/**
 * The session if it still exists, belongs to this user, is of the expected kind and has not expired.
 * Returns the document as it was BEFORE this request touched `lastSeenAt` (used for idle time-outs).
 */
export async function findActiveSession(sid: string, userId: string, kind: SessionKind = "platform", storeId?: string) {
  await connectDb();
  const s = await SessionModel.findOne({ _id: String(sid), userId: String(userId), expiresAt: { $gt: new Date() }, ...kindFilter(kind, storeId) }).lean();
  if (s && Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) {
    await SessionModel.updateOne({ _id: s._id }, { $set: { lastSeenAt: new Date() } });
  }
  return s;
}

export async function revokeSession(sid: string) {
  await connectDb();
  await SessionModel.deleteOne({ _id: String(sid) });
}

/** Signs out one device of this user (the user filter stops anyone removing other people's sessions). */
export async function revokeOwnSession(userId: string, sid: string) {
  await connectDb();
  await SessionModel.deleteOne({ _id: String(sid), userId: String(userId) });
}

/** Signs the user out everywhere (optionally keeping the current device). Works for platform users and shoppers. */
export async function revokeUserSessions(userId: string, exceptSid?: string) {
  await connectDb();
  await SessionModel.deleteMany(exceptSid ? { userId: String(userId), _id: { $ne: exceptSid } } : { userId: String(userId) });
}

export async function listSessions(userId: string, kind: SessionKind = "platform") {
  await connectDb();
  const rows = await SessionModel.find({ userId: String(userId), expiresAt: { $gt: new Date() }, ...(kind === "customer" ? { kind: "customer" } : { kind: { $ne: "customer" } }) })
    .sort({ lastSeenAt: -1 }).limit(100).lean();
  return rows.map((r) => ({ sid: r._id, createdAt: r.createdAt.toISOString(), lastSeenAt: r.lastSeenAt.toISOString(), ip: r.ip ?? "", userAgent: r.userAgent ?? "" }));
}

/** Number of devices signed in per user (super admin user list). */
export async function countActiveSessions(userIds: string[]) {
  await connectDb();
  if (!userIds.length) return new Map<string, number>();
  const rows = await SessionModel.aggregate<{ _id: string; n: number }>([
    { $match: { userId: { $in: userIds.map(String) }, expiresAt: { $gt: new Date() } } },
    { $group: { _id: "$userId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
}
