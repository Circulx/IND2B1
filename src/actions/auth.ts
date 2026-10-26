"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  OTP_RESEND_S, createUser, getUserByEmail, hashPassword, issueOtp, maskEmail, passwordProblem, recordLogin, updateOtpPayload, verifyLogin, verifyOtp, type User,
} from "@/lib/services";
import { EMAIL_FAILED, notifyWelcome, sendOtpEmail } from "@/lib/email/otp-mail";
import { appUrl, platformBrand } from "@/lib/email/brand";
import { createSession, revokeSession } from "@/lib/services/sessions";
import { SESSION_COOKIE, cookieOptions, homeFor, safeNext, signSession, verifySession } from "@/lib/auth/session";
import { ipFrom, rateLimit, waitText } from "@/lib/security";
import { audit } from "@/lib/audit";
import { isStaff } from "@/lib/types";

export type AuthState = { error?: string; errors?: Record<string, string>; values?: Record<string, string> };

/** Signs the user in on this device. Any session the browser already had is ended first (no session reuse). */
async function startSession(user: Pick<User, "id" | "name" | "email" | "role">) {
  const [h, jar] = await Promise.all([headers(), cookies()]);
  const previous = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (previous) await revokeSession(previous.sid);
  const sid = await createSession(user.id, user.role, { ip: ipFrom(h), userAgent: h.get("user-agent") ?? "" });
  jar.set(SESSION_COOKIE, await signSession({ userId: user.id, name: user.name, email: user.email, role: user.role, sid }), cookieOptions);
  await recordLogin(user.id);
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email."),
  password: z.string().min(1, "Enter your password.").max(128),
});

/** Shared checks for both sign-in pages: validation, brute-force limits, password, account status. */
async function checkCredentials(formData: FormData, scope: "merchant" | "staff"): Promise<{ user: User } | { state: AuthState }> {
  const values = { email: String(formData.get("email") ?? "").slice(0, 254) };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { state: { error: parsed.error.issues[0]?.message, values } };
  const { email, password } = parsed.data;

  // Brute-force protection: per account and per network address. Staff limits are stricter.
  const ip = ipFrom(await headers());
  const [perEmail, perIp] = await Promise.all([
    rateLimit(`login:${scope}:email:${email}`, scope === "staff" ? 5 : 8, 15 * 60),
    rateLimit(`login:${scope}:ip:${ip}`, scope === "staff" ? 20 : 40, 15 * 60),
  ]);
  if (!perEmail.ok || !perIp.ok) return { state: { error: `Too many sign-in attempts. Try again in ${waitText(Math.max(perEmail.retryAfterS, perIp.retryAfterS))}.`, values } };

  const user = await verifyLogin(email, password);
  if (!user) return { state: { error: "Email or password is incorrect.", values } };
  // From here the password was correct, so these messages reveal nothing to someone guessing.
  if (user.status === "disabled") return { state: { error: "This account has been disabled. Contact IND2B support.", values } };
  return { user };
}

/** Store owners sign in at /login. */
export async function logIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const r = await checkCredentials(formData, "merchant");
  if ("state" in r) return r.state;
  const { user } = r;
  if (isStaff(user.role)) return { error: "This is an IND2B staff account. Sign in at /admin/login.", values: { email: user.email } };
  await startSession(user);
  const next = safeNext(String(formData.get("next") ?? ""), homeFor(user.role));
  redirect(next.startsWith("/admin") ? homeFor(user.role) : next);
}

/** IND2B staff (admins and super admins) sign in at /admin/login. */
export async function staffLogIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const r = await checkCredentials(formData, "staff");
  if ("state" in r) return r.state;
  const { user } = r;
  if (!isStaff(user.role)) return { error: "Email or password is incorrect.", values: { email: user.email } };
  await startSession(user);
  await audit({ userId: user.id, name: user.name, email: user.email, role: user.role }, "auth.staff_login", user.id, { ip: ipFrom(await headers()) });
  const next = safeNext(String(formData.get("next") ?? ""), "/admin");
  redirect(next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin");
}

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email."),
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}\s?\d{5}$/, "Enter a 10-digit mobile number."),
  password: z.string().max(128),
  consent: z.literal("on", { message: "Please accept the terms to continue." }),
});

/** Step state of the e-mail verified sign-up. */
export type SignupState = AuthState & { step?: "details" | "verify"; email?: string; masked?: string; resendInS?: number; notice?: string };
export type OtpState = { error?: string; notice?: string; resendInS?: number };

/**
 * Sign-up step 1 (store owners). Validates the details, keeps them as a PENDING sign-up
 * (the password only as a bcrypt hash) and emails a 6-digit code. No account exists until
 * the code is confirmed in step 2. Staff accounts are never created here: a super admin adds them.
 */
export async function signUp(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const values = { name: String(formData.get("name") ?? "").slice(0, 80), email: String(formData.get("email") ?? "").slice(0, 254), phone: String(formData.get("phone") ?? "").slice(0, 20), consent: formData.get("consent") === "on" ? "on" : "" };
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
  const pwErr = passwordProblem(String(formData.get("password") ?? ""), values.email);
  if (pwErr) errors.password ??= pwErr;
  if (!parsed.success || Object.keys(errors).length) return { step: "details", errors, values };

  const ip = ipFrom(await headers());
  const limit = await rateLimit(`signup:ip:${ip}`, 10, 60 * 60);
  if (!limit.ok) return { step: "details", error: `Too many sign-ups from your network. Try again in ${waitText(limit.retryAfterS)}.`, values };
  const { email, name, phone, password } = parsed.data;
  if (await getUserByEmail(email)) return { step: "details", errors: { email: "An account with this email exists. Log in instead." }, values };

  const payload = {
    name, phone, passwordHash: await hashPassword(password),
    store: String(formData.get("store") ?? "").slice(0, 60), template: String(formData.get("template") ?? "").slice(0, 30),
  };
  const key = { purpose: "signup" as const, scope: "platform", email };
  const issued = await issueOtp({ ...key, payload });
  if (!issued.ok) {
    if (issued.reason === "cooldown" && (await updateOtpPayload(key, payload))) {
      return { step: "verify", email, masked: maskEmail(email), resendInS: issued.retryAfterS, values, notice: "We already sent a code to this address a moment ago. Enter it below." };
    }
    return { step: "details", error: `Too many codes were requested for this email. Try again in ${waitText(issued.retryAfterS)}.`, values };
  }
  if (!(await sendOtpEmail({ brand: platformBrand(), purpose: "signup", to: email, code: issued.code, name, ip }))) return { step: "details", error: EMAIL_FAILED, values };
  return { step: "verify", email, masked: maskEmail(email), resendInS: OTP_RESEND_S, values };
}

const otpSchema = z.object({ email: z.string().trim().toLowerCase().max(254).email(), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.") });

/** Explains a failed code check. */
function otpError(r: Exclude<Awaited<ReturnType<typeof verifyOtp>>, { ok: true }>) {
  if (r.reason === "invalid") return `That code is not correct. ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? "" : "s"} left.`;
  if (r.reason === "too_many_attempts") return "Too many wrong codes. Request a new code.";
  return "This code has expired or was already used. Request a new code.";
}

/** Sign-up step 2: the code from the email creates the account and signs the owner in. */
export async function verifySignup(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const p = otpSchema.safeParse({ email: formData.get("email"), code: String(formData.get("code") ?? "").replace(/\s/g, "") });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Enter the 6-digit code." };
  const ip = ipFrom(await headers());
  const limit = await rateLimit(`otp-verify:ip:${ip}`, 30, 15 * 60);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${waitText(limit.retryAfterS)}.` };

  const r = await verifyOtp({ purpose: "signup", scope: "platform", email: p.data.email, code: p.data.code });
  if (!r.ok) return { error: otpError(r) };
  const pending = r.payload;
  if (!pending?.passwordHash || !pending.name) return { error: "This sign-up has expired. Go back and start again." };

  let user;
  try {
    user = await createUser({ email: p.data.email, name: pending.name, phone: pending.phone ?? "", passwordHash: pending.passwordHash, role: "merchant", emailVerified: true });
  } catch (e) {
    if (e instanceof Error && e.message === "email_taken") return { error: "An account with this email already exists. Log in instead." };
    throw e;
  }
  await startSession(user);
  notifyWelcome({
    brand: platformBrand(), to: user.email, name: user.name, ctaLabel: "Open your dashboard", ctaUrl: appUrl("/dashboard"),
    lines: ["Next: name your store, pick a template and add your first products. Your store can take orders the same day."],
  });
  redirect(`/start?${new URLSearchParams({ ...(pending.store && { store: pending.store }), ...(pending.template && { template: pending.template }) })}`);
}

/** Sends a new sign-up code (the pending details are kept). */
export async function resendSignupCode(email: string): Promise<OtpState> {
  const e = z.string().trim().toLowerCase().max(254).email().safeParse(email);
  if (!e.success) return { error: "Go back and enter your email again." };
  const ip = ipFrom(await headers());
  const limit = await rateLimit(`otp-resend:ip:${ip}`, 20, 60 * 60);
  if (!limit.ok) return { error: `Too many requests. Try again in ${waitText(limit.retryAfterS)}.` };
  const issued = await issueOtp({ purpose: "signup", scope: "platform", email: e.data, keepPayload: true });
  if (!issued.ok) {
    if (issued.reason === "no_pending") return { error: "This sign-up has expired. Go back and start again." };
    return { error: issued.reason === "cooldown" ? `Please wait ${issued.retryAfterS} seconds before asking for another code.` : `Too many codes requested. Try again in ${waitText(issued.retryAfterS)}.`, resendInS: issued.retryAfterS };
  }
  if (!(await sendOtpEmail({ brand: platformBrand(), purpose: "signup", to: e.data, code: issued.code, ip }))) return { error: EMAIL_FAILED };
  return { notice: "A new code is on its way. Codes from earlier emails no longer work.", resendInS: OTP_RESEND_S };
}
