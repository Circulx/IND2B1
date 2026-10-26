"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { OTP_RESEND_S, adminSetPassword, findUserForReset, issueOtp, maskEmail, passwordProblem, verifyOtp, type User } from "@/lib/services";
import { EMAIL_FAILED, notifyPasswordChanged, sendOtpEmail } from "@/lib/email/otp-mail";
import { appUrl, platformBrand } from "@/lib/email/brand";
import { audit } from "@/lib/audit";
import { ipFrom, rateLimit, waitText } from "@/lib/security";
import { isStaff } from "@/lib/types";

/**
 * "Forgot password" for platform accounts, by emailed code.
 *   merchant → /forgot-password        staff (admin, super admin) → /admin/forgot-password
 *
 * The answer to "send me a code" is the same whether or not the email has an account,
 * so the page cannot be used to find out who is registered. The new password is checked
 * BEFORE the code is used, so a too-weak password does not burn the code. A reset signs
 * the account out of every device and sends a "your password was changed" email.
 */

type Audience = "merchant" | "staff";
export type ResetState = { step?: "request" | "reset"; email?: string; masked?: string; resendInS?: number; notice?: string; error?: string; errors?: Record<string, string> };
export type ResetOtpState = { error?: string; notice?: string; resendInS?: number };

const emailSchema = z.string().trim().toLowerCase().max(254).email("Enter a valid email.");
const audienceOf = (a: unknown): Audience => (a === "staff" ? "staff" : "merchant");
const loginPath = (a: Audience) => (a === "staff" ? "/admin/login" : "/login");
const eligible = (u: User | undefined, a: Audience): u is User =>
  !!u && u.status === "active" && (a === "staff" ? isStaff(u.role) : u.role === "merchant");
const GENERIC = (masked: string) => `If ${masked} has an account, we've sent it a 6-digit code. It can take a minute to arrive — check spam too.`;

/** Sends a code when the account exists. Returns an error only for problems the user can act on. */
async function sendResetCode(email: string, audience: Audience, ip: string): Promise<{ error?: string; retryAfterS?: number }> {
  const user = await findUserForReset(email);
  if (!eligible(user, audience)) return {};
  const issued = await issueOtp({ purpose: "reset", scope: "platform", email });
  if (!issued.ok) return issued.reason === "cooldown" ? { retryAfterS: issued.retryAfterS } : {};
  if (!(await sendOtpEmail({ brand: platformBrand(), purpose: "reset", to: email, code: issued.code, name: user.name, ip }))) return { error: EMAIL_FAILED };
  return {};
}

export async function requestPasswordReset(audienceRaw: Audience, _prev: ResetState, fd: FormData): Promise<ResetState> {
  const audience = audienceOf(audienceRaw);
  const e = emailSchema.safeParse(fd.get("email"));
  if (!e.success) return { step: "request", errors: { email: e.error.issues[0]?.message ?? "Enter a valid email." }, email: String(fd.get("email") ?? "").slice(0, 254) };
  const ip = ipFrom(await headers());
  const limit = await rateLimit(`reset:ip:${ip}`, 10, 60 * 60);
  if (!limit.ok) return { step: "request", error: `Too many requests from your network. Try again in ${waitText(limit.retryAfterS)}.`, email: e.data };
  const r = await sendResetCode(e.data, audience, ip);
  if (r.error) return { step: "request", error: r.error, email: e.data };
  return { step: "reset", email: e.data, masked: maskEmail(e.data), resendInS: r.retryAfterS ?? OTP_RESEND_S, notice: GENERIC(maskEmail(e.data)) };
}

export async function resendResetCode(audienceRaw: Audience, email: string): Promise<ResetOtpState> {
  const audience = audienceOf(audienceRaw);
  const e = emailSchema.safeParse(email);
  if (!e.success) return { error: "Go back and enter your email again." };
  const ip = ipFrom(await headers());
  const limit = await rateLimit(`reset:ip:${ip}`, 10, 60 * 60);
  if (!limit.ok) return { error: `Too many requests. Try again in ${waitText(limit.retryAfterS)}.` };
  const r = await sendResetCode(e.data, audience, ip);
  if (r.error) return { error: r.error };
  if (r.retryAfterS) return { error: `Please wait ${r.retryAfterS} seconds before asking for another code.`, resendInS: r.retryAfterS };
  return { notice: "If the account exists, a new code is on its way. Codes from earlier emails no longer work.", resendInS: OTP_RESEND_S };
}

const completeSchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email.") });

export async function completePasswordReset(audienceRaw: Audience, _prev: ResetOtpState & { errors?: Record<string, string> }, fd: FormData): Promise<ResetOtpState & { errors?: Record<string, string> }> {
  const audience = audienceOf(audienceRaw);
  const p = completeSchema.safeParse({ email: fd.get("email"), code: String(fd.get("code") ?? "").replace(/\s/g, "") });
  if (!p.success) return { errors: { [String(p.error.issues[0]?.path[0] ?? "code")]: p.error.issues[0]?.message ?? "Check the form." } };
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? "")) return { errors: { confirm: "The two passwords do not match." } };

  const ip = ipFrom(await headers());
  const limit = await rateLimit(`otp-verify:ip:${ip}`, 30, 15 * 60);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${waitText(limit.retryAfterS)}.` };

  // Check the password before the code is used up. Staff passwords must be stronger.
  const user = await findUserForReset(p.data.email);
  const problem = passwordProblem(password, p.data.email, { strong: audience === "staff" || (!!user && isStaff(user.role)) });
  if (problem) return { errors: { password: problem } };

  const r = await verifyOtp({ purpose: "reset", scope: "platform", email: p.data.email, code: p.data.code });
  if (!r.ok) {
    return { error: r.reason === "invalid" ? `That code is not correct. ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? "" : "s"} left.`
      : r.reason === "too_many_attempts" ? "Too many wrong codes. Request a new code." : "This code has expired or was already used. Request a new code." };
  }
  if (!eligible(user, audience)) return { error: "This code has expired or was already used. Request a new code." };

  await adminSetPassword(user.id, password);          // sets the hash and signs out every device
  if (isStaff(user.role)) await audit({ userId: user.id, name: user.name, email: user.email, role: user.role }, "auth.password_reset_by_email", user.id, { ip });
  notifyPasswordChanged({ brand: platformBrand(), to: user.email, name: user.name, ip, signInUrl: appUrl(loginPath(audience)) });
  redirect(`${loginPath(audience)}?reset=1`);
}
