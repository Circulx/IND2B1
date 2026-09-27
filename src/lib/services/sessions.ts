import "server-only";
import { randomBytes } from "node:crypto";
import { connectDb } from "../db/connect";
import { SessionModel } from "../db/models";
import { SESSION_MAX_AGE_S } from "../auth/session";
import type { Role } from "../types";

/** Server-side sessions: one document per signed-in device. */

export async function createSession(userId: string, role: Role, meta: { ip?: string; userAgent?: string } = {}) {
  await connectDb();
  const sid = randomBytes(32).toString("base64url");
  const now = new Date();
  await SessionModel.create({
    _id: sid, userId, role, createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_S * 1000),
    ip: meta.ip?.slice(0, 64), userAgent: meta.userAgent?.slice(0, 300),
  });
  return sid;
}

/** The session if it still exists, belongs to this user and has not expired. */
export async function findActiveSession(sid: string, userId: string) {
  await connectDb();
  const s = await SessionModel.findOne({ _id: sid, userId, expiresAt: { $gt: new Date() } }).lean();
  if (s && Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) {
    await SessionModel.updateOne({ _id: sid }, { $set: { lastSeenAt: new Date() } });
  }
  return s;
}

export async function revokeSession(sid: string) {
  await connectDb();
  await SessionModel.deleteOne({ _id: sid });
}

/** Signs out one device of this user (the user filter stops anyone removing other people's sessions). */
export async function revokeOwnSession(userId: string, sid: string) {
  await connectDb();
  await SessionModel.deleteOne({ _id: String(sid), userId });
}

/** Signs the user out everywhere (optionally keeping the current device). */
export async function revokeUserSessions(userId: string, exceptSid?: string) {
  await connectDb();
  await SessionModel.deleteMany(exceptSid ? { userId, _id: { $ne: exceptSid } } : { userId });
}

export async function listSessions(userId: string) {
  await connectDb();
  const rows = await SessionModel.find({ userId, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).lean();
  return rows.map((r) => ({ sid: r._id, createdAt: r.createdAt.toISOString(), lastSeenAt: r.lastSeenAt.toISOString(), ip: r.ip ?? "", userAgent: r.userAgent ?? "" }));
}
