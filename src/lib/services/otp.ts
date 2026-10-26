import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { connectDb } from "../db/connect";
import { EmailOtpModel, type OtpPurposeDoc } from "../db/models";

/**
 * Email one-time codes (sign-up verification and password reset).
 *
 *  - 6 random digits from the CSPRNG; only an HMAC-SHA256 of the code is stored (keyed with SESSION_SECRET)
 *  - valid for 10 minutes and usable once; asking for a new code replaces the old one
 *  - at most 5 wrong guesses per code, then a new code is needed
 *  - at most one email per 60 seconds and 5 per hour for the same address and purpose
 *  - scope keeps codes apart: "platform" (merchants and staff) or a store id (that store's shoppers)
 */

export const OTP_TTL_MIN = 10;
export const OTP_RESEND_S = 60;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS_PER_HOUR = 5;

export type OtpPurpose = OtpPurposeDoc;
type Key = { purpose: OtpPurpose; scope: string; email: string };

const idOf = (k: Key) => `${k.purpose}:${k.scope}:${k.email.trim().toLowerCase()}`;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ characters)");
    return "dev-only-secret-change-me-dev-only-secret";
  }
  return s;
}
const hash = (id: string, code: string) => createHmac("sha256", secret()).update(`${id}:${code}`).digest("base64url");

export type IssueResult =
  | { ok: true; code: string; expiresInMin: number }
  | { ok: false; reason: "cooldown" | "too_many" | "no_pending"; retryAfterS: number };

/**
 * Creates a new code for this address. `payload` (a pending sign-up) is stored with it;
 * pass `keepPayload: true` on "resend" to keep the payload of the earlier request.
 */
export async function issueOtp(k: Key & { payload?: Record<string, string>; keepPayload?: boolean }): Promise<IssueResult> {
  await connectDb();
  const _id = idOf(k);
  const now = Date.now();
  const prev = await EmailOtpModel.findById(_id).lean();
  if (prev) {
    const sinceLast = (now - prev.lastSentAt.getTime()) / 1000;
    if (sinceLast < OTP_RESEND_S) return { ok: false, reason: "cooldown", retryAfterS: Math.ceil(OTP_RESEND_S - sinceLast) };
    const windowAge = (now - prev.windowStart.getTime()) / 1000;
    if (windowAge < 3600 && prev.sendCount >= OTP_MAX_SENDS_PER_HOUR) return { ok: false, reason: "too_many", retryAfterS: Math.ceil(3600 - windowAge) };
  }
  if (k.keepPayload && !prev?.payload) return { ok: false, reason: "no_pending", retryAfterS: 0 };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const freshWindow = !prev || now - prev.windowStart.getTime() >= 3600_000;
  const windowStart = freshWindow ? new Date(now) : prev!.windowStart;
  await EmailOtpModel.updateOne(
    { _id },
    {
      $set: {
        purpose: k.purpose, scope: k.scope, email: k.email.trim().toLowerCase(),
        codeHash: hash(_id, code), attempts: 0, expiresAt: new Date(now + OTP_TTL_MIN * 60_000),
        sendCount: freshWindow ? 1 : (prev?.sendCount ?? 0) + 1, windowStart, lastSentAt: new Date(now),
        purgeAt: new Date(windowStart.getTime() + 2 * 3600_000),
        payload: k.keepPayload ? prev!.payload : (k.payload ?? null),
      },
      $setOnInsert: { createdAt: new Date(now) },
    },
    { upsert: true },
  );
  return { ok: true, code, expiresInMin: OTP_TTL_MIN };
}

export type VerifyResult =
  | { ok: true; payload: Record<string, string> | null }
  | { ok: false; reason: "invalid"; attemptsLeft: number }
  | { ok: false; reason: "expired" | "too_many_attempts" };

/** Checks a code. A correct code is consumed (single use) and its pending payload returned. */
export async function verifyOtp(k: Key & { code: string }): Promise<VerifyResult> {
  await connectDb();
  const _id = idOf(k);
  const code = String(k.code).replace(/\D/g, "");
  const doc = await EmailOtpModel.findById(_id).lean();
  if (!doc || !doc.codeHash || doc.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (doc.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  // Count the attempt first (atomically), so parallel guesses cannot exceed the limit.
  const counted = await EmailOtpModel.updateOne({ _id, codeHash: doc.codeHash, attempts: { $lt: OTP_MAX_ATTEMPTS } }, { $inc: { attempts: 1 } });
  if (counted.modifiedCount !== 1) return { ok: false, reason: "too_many_attempts" };

  const expected = Buffer.from(doc.codeHash);
  const given = Buffer.from(code.length === 6 ? hash(_id, code) : "x".repeat(expected.length));
  const match = given.length === expected.length && timingSafeEqual(given, expected);
  if (!match) {
    const left = OTP_MAX_ATTEMPTS - (doc.attempts + 1);
    return left > 0 ? { ok: false, reason: "invalid", attemptsLeft: left } : { ok: false, reason: "too_many_attempts" };
  }
  // Consume: only one request can win this update.
  const used = await EmailOtpModel.updateOne({ _id, codeHash: doc.codeHash }, { $set: { codeHash: null, payload: null } });
  if (used.modifiedCount !== 1) return { ok: false, reason: "expired" };
  return { ok: true, payload: doc.payload ?? null };
}

/** Seconds until another code may be sent to this address (0 = now). */
export async function otpCooldown(k: Key) {
  await connectDb();
  const doc = await EmailOtpModel.findById(idOf(k), { lastSentAt: 1 }).lean();
  return doc ? Math.max(0, Math.ceil(OTP_RESEND_S - (Date.now() - doc.lastSentAt.getTime()) / 1000)) : 0;
}

/** "pr•••@example.in" — shown on the code screen. */
export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const keep = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${keep}${"•".repeat(Math.max(2, Math.min(6, local.length - keep.length)))}@${domain}`;
}

/** Replaces the pending sign-up data of the current code without sending a new one (details re-submitted during the cooldown). */
export async function updateOtpPayload(k: Key, payload: Record<string, string>) {
  await connectDb();
  const res = await EmailOtpModel.updateOne({ _id: idOf(k), codeHash: { $type: "string" } }, { $set: { payload } });
  return res.matchedCount === 1;
}
