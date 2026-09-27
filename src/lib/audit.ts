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
