import "server-only";
import { randomBytes } from "node:crypto";
import { connectDb } from "../db/connect";
import { EmailTokenModel } from "../db/models";

export type TokenPurpose = "verify_email" | "reset_password";
const TTL_S: Record<TokenPurpose, number> = { verify_email: 60 * 60 * 24, reset_password: 60 * 60 };

/**
 * Issues a single-use token for `purpose`, invalidating any earlier unused
 * token of the same purpose for this user first (so only the latest email
 * link works).
 */
export async function createEmailToken(userId: string, email: string, purpose: TokenPurpose) {
  await connectDb();
  await EmailTokenModel.deleteMany({ userId, purpose });
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await EmailTokenModel.create({ _id: token, userId, purpose, email, createdAt: now, expiresAt: new Date(now.getTime() + TTL_S[purpose] * 1000) });
  return token;
}

/** Checks a token without spending it — safe to call on a GET page render (email scanners pre-fetch links). */
export async function peekEmailToken(token: string, purpose: TokenPurpose) {
  await connectDb();
  if (!token || token.length > 128) return null;
  const doc = await EmailTokenModel.findOne({ _id: token, purpose, expiresAt: { $gt: new Date() } }).lean();
  return doc ? { userId: doc.userId, email: doc.email } : null;
}

/** Spends a token: only succeeds once, even under concurrent requests (atomic findOneAndDelete). */
export async function consumeEmailToken(token: string, purpose: TokenPurpose) {
  await connectDb();
  if (!token || token.length > 128) return null;
  const doc = await EmailTokenModel.findOneAndDelete({ _id: token, purpose, expiresAt: { $gt: new Date() } }).lean();
  return doc ? { userId: doc.userId, email: doc.email } : null;
}
