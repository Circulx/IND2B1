import "server-only";
import { PLANS as DEFAULT_PLANS } from "../catalog";
import { connectDb } from "../db/connect";
import { PlanModel } from "../db/models";
import type { Plan, PlanId } from "../types";

/**
 * Subscription plans, stored in MongoDB (collection "plans").
 * The first read inserts the defaults from src/lib/catalog.ts (only missing plans; edits are never
 * overwritten). Super admins change name, price, fee and features in /superadmin/plans.
 * Plan ids (starter, grow, pro) are fixed because stores and feature checks refer to them.
 */
async function ensurePlans() {
  await connectDb();
  if ((await PlanModel.countDocuments({})) >= DEFAULT_PLANS.length) return;
  await Promise.all(DEFAULT_PLANS.map((p, i) => PlanModel.updateOne({ _id: p.id }, {
    $setOnInsert: { name: p.name, pricePaise: p.pricePaise, transactionFeePct: p.transactionFeePct, features: p.features, order: i, updatedAt: new Date() },
  }, { upsert: true })));
}

export async function listPlans(): Promise<Plan[]> {                                  // GET /billing/plans
  await ensurePlans();
  const rows = await PlanModel.find({}).sort({ order: 1 }).lean();
  return rows.map((r) => ({ id: r._id as PlanId, name: r.name, pricePaise: r.pricePaise ?? null, transactionFeePct: r.transactionFeePct, features: r.features ?? [] }));
}

export async function getPlan(id: string) {
  return (await listPlans()).find((p) => p.id === id);
}

export const isPlanId = (id: string): id is PlanId => DEFAULT_PLANS.some((p) => p.id === id);

export async function updatePlan(id: PlanId, patch: { name: string; pricePaise: number; transactionFeePct: number; features: string[] }) {
  await ensurePlans();
  const before = await PlanModel.findById(id).lean();
  if (!before) throw new Error("not_found");
  await PlanModel.updateOne({ _id: id }, { $set: { ...patch, updatedAt: new Date() } });
  return { before: { name: before.name, pricePaise: before.pricePaise, transactionFeePct: before.transactionFeePct, features: before.features }, after: patch };
}
