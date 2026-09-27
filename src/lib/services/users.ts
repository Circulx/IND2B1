import "server-only";
import bcrypt from "bcryptjs";
import { connectDb } from "../db/connect";
import { UserModel } from "../db/models";
import type { Role, User } from "../types";

/** Accounts for store owners and the IND2B team. Passwords are bcrypt-hashed (cost 12). */

const BCRYPT_COST = 12;
const toUser = (r: { _id: string; email: string; name: string; phone?: string; role: Role; createdAt: Date }): User =>
  ({ id: r._id, email: r.email, name: r.name, phone: r.phone ?? "", role: r.role, createdAt: r.createdAt.toISOString() });

const COMMON = new Set(["password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "iloveyou", "admin123", "welcome1", "india123", "abcd1234"]);

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(pw: string, email?: string) {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (pw.length > 128) return "Use at most 128 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use letters and at least one number.";
  if (COMMON.has(pw.toLowerCase())) return "This password is too common. Choose another.";
  if (email && pw.toLowerCase().includes(email.split("@")[0]!.toLowerCase()) && email.split("@")[0]!.length >= 4) return "Don't use your email name in the password.";
  return null;
}

export async function getUser(id: string) {
  await connectDb();
  const r = await UserModel.findById(String(id)).lean();
  return r ? toUser(r) : undefined;
}

export async function createUser(input: { email: string; name: string; phone: string; password: string; role?: Role }) {
  await connectDb();
  const email = input.email.trim().toLowerCase();
  if (await UserModel.exists({ email })) throw new Error("email_taken");
  const doc = {
    _id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    email, name: input.name.trim(), phone: input.phone.trim(), role: input.role ?? "merchant",
    passwordHash: await bcrypt.hash(input.password, BCRYPT_COST), createdAt: new Date(),
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

export async function listUsers(limit = 200) {
  await connectDb();
  return (await UserModel.find().sort({ createdAt: -1 }).limit(limit).lean()).map(toUser);
}
