import "server-only";
import bcrypt from "bcryptjs";
import { SessionModel, StoreModel, UserModel } from "./models";

/**
 * Creates (or promotes) the platform's super admin from environment variables,
 * once per server start. Works with or without demo data, so production never
 * depends on seeded accounts.
 *
 *   SUPERADMIN_EMAIL=owner@yourcompany.in
 *   SUPERADMIN_PASSWORD=<12+ chars, upper + lower case, digit, symbol>
 *   SUPERADMIN_NAME="Your Name"                  (optional)
 *   SUPERADMIN_RESET_PASSWORD=true               (optional: overwrite the password of an existing account once,
 *                                                 e.g. to recover access; remove it again afterwards)
 *
 * An existing staff account (or a merchant account that owns no stores) with that email is
 * promoted to super admin. A merchant who owns stores is never converted automatically.
 * Alternative: `npm run superadmin` (scripts/create-superadmin.mjs).
 */
export async function ensureSuperAdmin() {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    if (process.env.NODE_ENV === "production" && !(await UserModel.exists({ role: "superadmin", status: { $ne: "disabled" } }))) {
      console.warn("[ind2b] No super admin exists. Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD, or run `npm run superadmin`.");
    }
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error("[ind2b] SUPERADMIN_EMAIL is not a valid email; super admin not created."); return; }
  const weak = password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password);
  if (weak) { console.error("[ind2b] SUPERADMIN_PASSWORD is too weak (12+ characters with upper and lower case, a digit and a symbol); super admin not created."); return; }

  const existing = await UserModel.findOne({ email }).lean();
  if (!existing) {
    await UserModel.create({
      _id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      email, name: process.env.SUPERADMIN_NAME?.trim().slice(0, 80) || "Super Admin", phone: "", role: "superadmin", status: "active",
      passwordHash: await bcrypt.hash(password, 12), createdAt: new Date(),
    }).catch((e: { code?: number }) => { if (e.code !== 11000) throw e; });   // another instance created it at the same moment
    console.info(`[ind2b] Super admin ${email} created.`);
    return;
  }

  const $set: Record<string, unknown> = {};
  if (existing.role !== "superadmin") {
    if (existing.role === "merchant" && (await StoreModel.exists({ ownerId: existing._id }))) {
      console.error(`[ind2b] ${email} is a merchant who owns stores; it was NOT made super admin. Use a separate email for the super admin.`);
      return;
    }
    $set.role = "superadmin";
  }
  if (existing.status === "disabled") $set.status = "active";
  if (process.env.SUPERADMIN_RESET_PASSWORD === "true" && !(await bcrypt.compare(password, existing.passwordHash))) {
    $set.passwordHash = await bcrypt.hash(password, 12);
    $set.passwordChangedAt = new Date();
  }
  if (Object.keys($set).length) {
    await UserModel.updateOne({ _id: existing._id }, { $set });
    await SessionModel.deleteMany({ userId: existing._id });   // new role / password applies from the next sign-in
    console.info(`[ind2b] Super admin ${email} updated (${Object.keys($set).filter((k) => k !== "passwordChangedAt").join(", ")}).`);
  }
}
