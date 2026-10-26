import "server-only";
import bcrypt from "bcryptjs";
import { connectDb } from "../db/connect";
import { StoreModel, UserModel, type UserDoc } from "../db/models";
import type { Role, User, UserStatus } from "../types";
import { revokeUserSessions } from "./sessions";

/** Accounts for store owners and the IND2B team. Passwords are bcrypt-hashed (cost 12). */

export const BCRYPT_COST = 12;
const toUser = (r: Pick<UserDoc, "_id" | "email" | "name" | "phone" | "role" | "status" | "createdAt" | "lastLoginAt">): User => ({
  id: r._id, email: r.email, name: r.name, phone: r.phone ?? "", role: r.role, status: r.status ?? "active",
  createdAt: r.createdAt.toISOString(), ...(r.lastLoginAt ? { lastLoginAt: r.lastLoginAt.toISOString() } : {}),
});

const COMMON = new Set(["password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "iloveyou", "admin123", "welcome1", "india123", "abcd1234", "admin@123", "password@123", "superadmin"]);

/**
 * Returns an error message, or null when the password is acceptable.
 * Staff accounts (admin, superadmin) need 12+ characters with upper and lower case, a digit and a symbol.
 */
export function passwordProblem(pw: string, email?: string, opts: { strong?: boolean } = {}) {
  const min = opts.strong ? 12 : 8;
  if (pw.length < min) return `Use at least ${min} characters.`;
  if (pw.length > 128) return "Use at most 128 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use letters and at least one number.";
  if (opts.strong && (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[^A-Za-z0-9]/.test(pw))) return "Staff passwords need upper and lower case letters, a number and a symbol.";
  if (COMMON.has(pw.toLowerCase())) return "This password is too common. Choose another.";
  const local = email?.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && pw.toLowerCase().includes(local)) return "Don't use your email name in the password.";
  return null;
}

export async function getUser(id: string) {
  await connectDb();
  const r = await UserModel.findById(String(id)).lean();
  return r ? toUser(r) : undefined;
}

export async function getUserByEmail(email: string) {
  await connectDb();
  const r = await UserModel.findOne({ email: String(email).trim().toLowerCase() }).lean();
  return r ? toUser(r) : undefined;
}

/**
 * Creates a platform account. Pass `passwordHash` (already bcrypt-hashed, e.g. from a verified
 * pending sign-up) instead of `password`, and `emailVerified` when the address was confirmed by code.
 */
export async function createUser(input: { email: string; name: string; phone: string; role?: Role; emailVerified?: boolean } & ({ password: string } | { passwordHash: string })) {
  await connectDb();
  const email = input.email.trim().toLowerCase();
  if (await UserModel.exists({ email })) throw new Error("email_taken");
  const doc = {
    _id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    email, name: input.name.trim(), phone: input.phone.trim(), role: input.role ?? "merchant", status: "active" as const,
    passwordHash: "passwordHash" in input ? input.passwordHash : await bcrypt.hash(input.password, BCRYPT_COST), createdAt: new Date(),
    ...(input.emailVerified ? { emailVerifiedAt: new Date() } : {}),
  };
  try {
    await UserModel.create(doc);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new Error("email_taken");
    throw e;
  }
  return toUser(doc);
}

let dummyHash: string | undefined;

/** Returns the user when the email and password match, otherwise null (same answer for both failures). */
export async function verifyLogin(email: string, password: string) {
  await connectDb();
  const r = await UserModel.findOne({ email: String(email).trim().toLowerCase() }).lean();
  // Compare against a dummy hash when the user does not exist so timing does not reveal which emails are registered.
  const ok = await bcrypt.compare(String(password), r?.passwordHash ?? (dummyHash ??= bcrypt.hashSync("not-a-real-password", BCRYPT_COST)));
  return r && ok ? toUser(r) : null;
}

export async function recordLogin(userId: string) {
  await connectDb();
  await UserModel.updateOne({ _id: String(userId) }, { $set: { lastLoginAt: new Date() } });
}

export async function updateProfile(userId: string, patch: { name: string; phone: string }) {
  await connectDb();
  await UserModel.updateOne({ _id: userId }, { $set: { name: patch.name.trim(), phone: patch.phone.trim() } });
}

/** Changes the password after checking the current one. Returns false when the current password is wrong. */
export async function changePassword(userId: string, current: string, next: string) {
  await connectDb();
  const r = await UserModel.findById(userId).lean();
  if (!r || !(await bcrypt.compare(current, r.passwordHash))) return false;
  await UserModel.updateOne({ _id: userId }, { $set: { passwordHash: await bcrypt.hash(next, BCRYPT_COST), passwordChangedAt: new Date() } });
  return true;
}

export async function listUsers(limit = 200, filter: { q?: string; role?: Role; status?: UserStatus } = {}) {
  await connectDb();
  const query: Record<string, unknown> = {};
  if (filter.role) query.role = filter.role;
  if (filter.status === "disabled") query.status = "disabled";
  if (filter.status === "active") query.status = { $ne: "disabled" };
  const q = filter.q?.trim().toLowerCase().slice(0, 100);
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ email: rx }, { name: rx }, { _id: rx }];
  }
  return (await UserModel.find(query).sort({ createdAt: -1 }).limit(Math.min(limit, 1000)).lean()).map(toUser);
}

/* ================================================================ super admin: user & staff management */

/** Active super admins. The platform must always keep at least one. */
export async function countActiveSuperAdmins() {
  await connectDb();
  return UserModel.countDocuments({ role: "superadmin", status: { $ne: "disabled" } });
}

/**
 * Changes a STAFF member's role (admin ⇄ superadmin). Merchants are not converted into staff
 * (or the other way round): their stores, orders and payouts belong to a merchant account.
 * Every existing session of the user is ended, so the new role applies from their next sign-in.
 */
export async function setStaffRole(userId: string, role: "admin" | "superadmin") {
  await connectDb();
  const u = await UserModel.findById(String(userId)).lean();
  if (!u) throw new Error("not_found");
  if (u.role === "merchant") throw new Error("not_staff");
  if (u.role === role) return toUser(u);
  if (u.role === "superadmin" && (u.status ?? "active") === "active" && (await countActiveSuperAdmins()) <= 1) throw new Error("last_superadmin");
  await UserModel.updateOne({ _id: u._id }, { $set: { role } });
  await revokeUserSessions(u._id);
  return (await getUser(u._id))!;
}

/** Disables (signs out everywhere, blocks sign-in) or re-enables any platform account. */
export async function setUserStatus(userId: string, status: UserStatus) {
  await connectDb();
  const u = await UserModel.findById(String(userId)).lean();
  if (!u) throw new Error("not_found");
  if (status === "disabled" && u.role === "superadmin" && (u.status ?? "active") === "active" && (await countActiveSuperAdmins()) <= 1) throw new Error("last_superadmin");
  await UserModel.updateOne({ _id: u._id }, { $set: { status } });
  if (status === "disabled") await revokeUserSessions(u._id);
  return (await getUser(u._id))!;
}

/** Sets a new password chosen by a super admin and signs the user out everywhere. */
export async function adminSetPassword(userId: string, password: string) {
  await connectDb();
  const res = await UserModel.updateOne({ _id: String(userId) }, { $set: { passwordHash: await bcrypt.hash(password, BCRYPT_COST), passwordChangedAt: new Date() } });
  if (res.matchedCount === 0) throw new Error("not_found");
  await revokeUserSessions(String(userId));
}

/** Store count per owner (super admin user list). */
export async function storeCountsByOwner(ownerIds: string[]) {
  await connectDb();
  if (!ownerIds.length) return new Map<string, number>();
  const rows = await StoreModel.aggregate<{ _id: string; n: number }>([
    { $match: { ownerId: { $in: ownerIds.map(String) } } },
    { $group: { _id: "$ownerId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
}

/** bcrypt hash for a password chosen before the account exists (pending email-verified sign-up). */
export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

/** Raw lookup for the password-reset flow (includes status). */
export async function findUserForReset(email: string) {
  await connectDb();
  const r = await UserModel.findOne({ email: String(email).trim().toLowerCase() }, { passwordHash: 0 }).lean();
  return r ? toUser(r) : undefined;
}
