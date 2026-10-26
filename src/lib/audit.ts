import "server-only";
import { connectDb } from "./db/connect";
import { AuditLogModel } from "./db/models";
import type { Session } from "./types";

/** Every admin decision is written to the append-only audit log with the admin's identity. */
export async function audit(session: Session, action: string, target: string, detail?: Record<string, unknown>) {
  await connectDb();
  await AuditLogModel.create({ at: new Date(), actorId: session.userId, actorName: session.name, action, target, detail });
}

export async function recentAudit(limit = 20) {
  await connectDb();
  const rows = await AuditLogModel.find().sort({ at: -1 }).limit(limit).lean();
  return rows.map((r) => ({ id: String(r._id), at: (r.at as Date).toISOString(), actorName: String(r.actorName ?? ""), action: String(r.action ?? ""), target: String(r.target ?? "") }));
}

/** Full audit log for super admins, newest first, optionally filtered by action, target or admin name. */
export async function listAudit(opts: { q?: string; limit?: number } = {}) {
  await connectDb();
  const q = opts.q?.trim().slice(0, 100);
  const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  const rows = await AuditLogModel.find(rx ? { $or: [{ action: rx }, { target: rx }, { actorName: rx }, { actorId: rx }] } : {})
    .sort({ at: -1 }).limit(Math.min(opts.limit ?? 200, 1000)).lean();
  return rows.map((r) => ({
    id: String(r._id), at: (r.at as Date).toISOString(), actorId: String(r.actorId ?? ""), actorName: String(r.actorName ?? ""),
    action: String(r.action ?? ""), target: String(r.target ?? ""), detail: r.detail ? JSON.stringify(r.detail).slice(0, 300) : "",
  }));
}
