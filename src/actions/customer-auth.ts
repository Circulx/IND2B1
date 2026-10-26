"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  OTP_RESEND_S, changeCustomerPassword, createCustomer, getCustomerByEmail, hashPassword, issueOtp, maskEmail, passwordProblem, revokeUserSessions,
  setCustomerPassword, updateCustomerProfile, updateOtpPayload, verifyCustomerLogin, verifyOtp,
} from "@/lib/services";
import { EMAIL_FAILED, notifyPasswordChanged, notifyWelcome, sendOtpEmail } from "@/lib/email/otp-mail";
import { absoluteStoreUrl, storeBrand } from "@/lib/email/brand";
import { endCustomerSession, getCustomerSession, startCustomerSession } from "@/lib/auth/customer";
import { safeNext } from "@/lib/auth/session";
import { resolveStore } from "@/lib/storefront";
import { ipFrom, rateLimit, waitText } from "@/lib/security";

/**
 * Shopper accounts on a store: register, sign in, sign out, profile and password.
 * Every action resolves the store from the request first, so an account only ever
 * exists, and only ever works, on the store it was created on.
 */

export type CustomerAuthState = { error?: string; ok?: string; errors?: Record<string, string>; values?: Record<string, string> };

/** Only redirect inside this store after sign-in. */
function nextInStore(raw: FormDataEntryValue | null, base: string) {
  const fallback = `${base}/account`;
  const next = safeNext(String(raw ?? ""), fallback);
  if (base && next !== base && !next.startsWith(`${base}/`) && !next.startsWith(`${base}?`)) return fallback;
  return /\/account\/(login|register|forgot-password)/.test(next) ? fallback : next;
}

const email = z.string().trim().toLowerCase().max(254).email("Enter a valid email.");
const phone = z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a 10-digit mobile number.").or(z.literal(""));

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email,
  phone,
  password: z.string().max(128),
});

export type CustomerSignupState = CustomerAuthState & { step?: "details" | "verify"; email?: string; masked?: string; resendInS?: number; notice?: string };
export type CustomerOtpState = { error?: string; notice?: string; resendInS?: number; errors?: Record<string, string> };

const codeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email.");
function otpMessage(r: { ok: false; reason: "invalid"; attemptsLeft: number } | { ok: false; reason: "expired" | "too_many_attempts" }) {
  if (r.reason === "invalid") return `That code is not correct. ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? "" : "s"} left.`;
  if (r.reason === "too_many_attempts") return "Too many wrong codes. Request a new code.";
  return "This code has expired or was already used. Request a new code.";
}

/**
 * Registration step 1: validate, keep the details as a pending sign-up (password only as a
 * bcrypt hash) and email a code in the store's own branding. The account is created in step 2.
 */
export async function customerRegister(storeParam: string, _prev: CustomerSignupState, fd: FormData): Promise<CustomerSignupState> {
  const { store } = await resolveStore(storeParam);
  const values = { name: String(fd.get("name") ?? "").slice(0, 80), email: String(fd.get("email") ?? "").slice(0, 254), phone: String(fd.get("phone") ?? "").slice(0, 20) };
  const parsed = registerSchema.safeParse({ name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") ?? "", password: fd.get("password") ?? "" });
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
  const pwErr = passwordProblem(String(fd.get("password") ?? ""), values.email);
  if (pwErr) errors.password ??= pwErr;
  if (String(fd.get("password") ?? "") !== String(fd.get("confirm") ?? "")) errors.confirm ??= "The two passwords do not match.";
  if (!parsed.success || Object.keys(errors).length) return { step: "details", errors, values };

  const ip = ipFrom(await headers());
  const limit = await rateLimit(`c-register:${store.id}:${ip}`, 10, 60 * 60);
  if (!limit.ok) return { step: "details", error: `Too many sign-ups from your network. Try again in ${waitText(limit.retryAfterS)}.`, values };
  if (await getCustomerByEmail(store.id, parsed.data.email)) return { step: "details", errors: { email: "You already have an account here. Sign in instead." }, values };

  const payload = { name: parsed.data.name, phone: parsed.data.phone, passwordHash: await hashPassword(parsed.data.password), next: String(fd.get("next") ?? "").slice(0, 300) };
  const key = { purpose: "signup" as const, scope: store.id, email: parsed.data.email };
  const issued = await issueOtp({ ...key, payload });
  if (!issued.ok) {
    if (issued.reason === "cooldown" && (await updateOtpPayload(key, payload))) {
      return { step: "verify", email: parsed.data.email, masked: maskEmail(parsed.data.email), resendInS: issued.retryAfterS, values, notice: "We already sent a code a moment ago. Enter it below." };
    }
    return { step: "details", error: `Too many codes were requested for this email. Try again in ${waitText(issued.retryAfterS)}.`, values };
  }
  if (!(await sendOtpEmail({ brand: storeBrand(store), purpose: "signup", to: parsed.data.email, code: issued.code, name: parsed.data.name, ip }))) return { step: "details", error: EMAIL_FAILED, values };
  return { step: "verify", email: parsed.data.email, masked: maskEmail(parsed.data.email), resendInS: OTP_RESEND_S, values };
}

/** Registration step 2: the emailed code creates the account and signs the shopper in. */
export async function customerVerifyRegistration(storeParam: string, _prev: CustomerOtpState, fd: FormData): Promise<CustomerOtpState> {
  const { store, base } = await resolveStore(storeParam);
  const em = email.safeParse(fd.get("email"));
  const code = codeSchema.safeParse(String(fd.get("code") ?? "").replace(/\s/g, ""));
  if (!em.success) return { error: "Go back and enter your email again." };
  if (!code.success) return { error: code.error.issues[0]?.message };
  const limit = await rateLimit(`otp-verify:ip:${ipFrom(await headers())}`, 30, 15 * 60);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${waitText(limit.retryAfterS)}.` };

  const r = await verifyOtp({ purpose: "signup", scope: store.id, email: em.data, code: code.data });
  if (!r.ok) return { error: otpMessage(r) };
  const pending = r.payload;
  if (!pending?.passwordHash || !pending.name) return { error: "This sign-up has expired. Go back and start again." };
  let customer;
  try {
    customer = await createCustomer(store.id, { email: em.data, name: pending.name, phone: pending.phone ?? "", passwordHash: pending.passwordHash, emailVerified: true });
  } catch (e) {
    if (e instanceof Error && e.message === "email_taken") return { error: "You already have an account here. Sign in instead." };
    throw e;
  }
  await startCustomerSession(customer);
  notifyWelcome({
    brand: storeBrand(store), to: customer.email, name: customer.name, ctaLabel: `Shop at ${store.name}`, ctaUrl: absoluteStoreUrl(store),
    lines: ["You can now track your orders and check out faster when you're signed in."],
  });
  redirect(nextInStore(pending.next ?? null, base));
}

export async function customerResendRegistrationCode(storeParam: string, emailRaw: string): Promise<CustomerOtpState> {
  const { store } = await resolveStore(storeParam);
  const em = email.safeParse(emailRaw);
  if (!em.success) return { error: "Go back and enter your email again." };
  const ip = ipFrom(await headers());
  const limit = await rateLimit(`otp-resend:${store.id}:${ip}`, 20, 60 * 60);
  if (!limit.ok) return { error: `Too many requests. Try again in ${waitText(limit.retryAfterS)}.` };
  const issued = await issueOtp({ purpose: "signup", scope: store.id, email: em.data, keepPayload: true });
  if (!issued.ok) {
    if (issued.reason === "no_pending") return { error: "This sign-up has expired. Go back and start again." };
    return { error: issued.reason === "cooldown" ? `Please wait ${issued.retryAfterS} seconds before asking for another code.` : `Too many codes requested. Try again in ${waitText(issued.retryAfterS)}.`, resendInS: issued.retryAfterS };
  }
  if (!(await sendOtpEmail({ brand: storeBrand(store), purpose: "signup", to: em.data, code: issued.code, ip }))) return { error: EMAIL_FAILED };
  return { notice: "A new code is on its way. Codes from earlier emails no longer work.", resendInS: OTP_RESEND_S };
}

/* ------------------------------------------------------------------ forgot password (shoppers) */
export type CustomerResetState = { step?: "request" | "reset"; email?: string; masked?: string; resendInS?: number; notice?: string; error?: string; errors?: Record<string, string> };

async function sendCustomerResetCode(store: Awaited<ReturnType<typeof resolveStore>>["store"], addr: string, ip: string): Promise<{ error?: string; retryAfterS?: number }> {
  const c = await getCustomerByEmail(store.id, addr);
  if (!c || c.status !== "active") return {};                     // same answer for unknown emails
  const issued = await issueOtp({ purpose: "reset", scope: store.id, email: addr });
  if (!issued.ok) return issued.reason === "cooldown" ? { retryAfterS: issued.retryAfterS } : {};
  if (!(await sendOtpEmail({ brand: storeBrand(store), purpose: "reset", to: addr, code: issued.code, name: c.name, ip }))) return { error: EMAIL_FAILED };
  return {};
}

export async function customerForgotStart(storeParam: string, _prev: CustomerResetState, fd: FormData): Promise<CustomerResetState> {
  const { store } = await resolveStore(storeParam);
  const em = email.safeParse(fd.get("email"));
  if (!em.success) return { step: "request", errors: { email: em.error.issues[0]?.message ?? "Enter a valid email." }, email: String(fd.get("email") ?? "").slice(0, 254) };
  const ip = ipFrom(await headers());
  const limit = await rateLimit(`c-reset:${store.id}:${ip}`, 10, 60 * 60);
  if (!limit.ok) return { step: "request", error: `Too many requests from your network. Try again in ${waitText(limit.retryAfterS)}.`, email: em.data };
  const r = await sendCustomerResetCode(store, em.data, ip);
  if (r.error) return { step: "request", error: r.error, email: em.data };
  const masked = maskEmail(em.data);
  return { step: "reset", email: em.data, masked, resendInS: r.retryAfterS ?? OTP_RESEND_S, notice: `If ${masked} has an account at ${store.name}, we've sent it a 6-digit code. Check spam too.` };
}

export async function customerForgotResend(storeParam: string, emailRaw: string): Promise<CustomerOtpState> {
  const { store } = await resolveStore(storeParam);
  const em = email.safeParse(emailRaw);
  if (!em.success) return { error: "Go back and enter your email again." };
  const ip = ipFrom(await headers());
  const limit = await rateLimit(`c-reset:${store.id}:${ip}`, 10, 60 * 60);
  if (!limit.ok) return { error: `Too many requests. Try again in ${waitText(limit.retryAfterS)}.` };
  const r = await sendCustomerResetCode(store, em.data, ip);
  if (r.error) return { error: r.error };
  if (r.retryAfterS) return { error: `Please wait ${r.retryAfterS} seconds before asking for another code.`, resendInS: r.retryAfterS };
  return { notice: "If the account exists, a new code is on its way.", resendInS: OTP_RESEND_S };
}

export async function customerResetPassword(storeParam: string, _prev: CustomerOtpState, fd: FormData): Promise<CustomerOtpState> {
  const { store, base } = await resolveStore(storeParam);
  const em = email.safeParse(fd.get("email"));
  const code = codeSchema.safeParse(String(fd.get("code") ?? "").replace(/\s/g, ""));
  if (!em.success) return { error: "Go back and enter your email again." };
  if (!code.success) return { errors: { code: code.error.issues[0]?.message ?? "Enter the code." } };
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? "")) return { errors: { confirm: "The two passwords do not match." } };
  const problem = passwordProblem(password, em.data);
  if (problem) return { errors: { password: problem } };
  const ip = ipFrom(await headers());
  const limit = await rateLimit(`otp-verify:ip:${ip}`, 30, 15 * 60);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${waitText(limit.retryAfterS)}.` };

  const r = await verifyOtp({ purpose: "reset", scope: store.id, email: em.data, code: code.data });
  if (!r.ok) return { error: otpMessage(r) };
  const c = await getCustomerByEmail(store.id, em.data);
  if (!c || c.status !== "active") return { error: "This code has expired or was already used. Request a new code." };
  await setCustomerPassword(store.id, c.id, password);           // also signs out every device
  notifyPasswordChanged({ brand: storeBrand(store), to: c.email, name: c.name, ip, signInUrl: absoluteStoreUrl(store, "/account/login") });
  redirect(`${base}/account/login?reset=1`);
}

const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.").max(128) });

export async function customerLogin(storeParam: string, _prev: CustomerAuthState, fd: FormData): Promise<CustomerAuthState> {
  const { store, base } = await resolveStore(storeParam);
  const values = { email: String(fd.get("email") ?? "").slice(0, 254) };
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };

  const ip = ipFrom(await headers());
  const [perEmail, perIp] = await Promise.all([
    rateLimit(`c-login:${store.id}:email:${parsed.data.email}`, 8, 15 * 60),
    rateLimit(`c-login:${store.id}:ip:${ip}`, 40, 15 * 60),
  ]);
  if (!perEmail.ok || !perIp.ok) return { error: `Too many sign-in attempts. Try again in ${waitText(Math.max(perEmail.retryAfterS, perIp.retryAfterS))}.`, values };

  const customer = await verifyCustomerLogin(store.id, parsed.data.email, parsed.data.password);
  if (!customer) return { error: "Email or password is incorrect.", values };
  if (customer.status === "disabled") return { error: `This account has been disabled. Contact ${store.name} for help.`, values };
  await endCustomerSession(store.id);          // never reuse an earlier session on this browser
  await startCustomerSession(customer);
  redirect(nextInStore(fd.get("next"), base));
}

export async function customerLogout(storeParam: string) {
  const { store, base } = await resolveStore(storeParam);
  await endCustomerSession(store.id);
  redirect(`${base}/`);
}

const profileSchema = z.object({ name: z.string().trim().min(2, "Enter your name.").max(80), phone });

export async function saveCustomerProfile(storeParam: string, _prev: CustomerAuthState, fd: FormData): Promise<CustomerAuthState> {
  const { store, base } = await resolveStore(storeParam);
  const me = await getCustomerSession(store.id);
  if (!me) redirect(`${base}/account/login`);
  const p = profileSchema.safeParse({ name: fd.get("name"), phone: fd.get("phone") ?? "" });
  if (!p.success) return { errors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  await updateCustomerProfile(store.id, me.customerId, p.data);
  revalidatePath(`/store/${store.slug}/account`);   // the form shows the saved values after React resets it
  return { ok: "Details saved." };
}

/** Changing the password signs this shopper out of every other device. */
export async function changeCustomerPasswordAction(storeParam: string, _prev: CustomerAuthState, fd: FormData): Promise<CustomerAuthState> {
  const { store, base } = await resolveStore(storeParam);
  const me = await getCustomerSession(store.id);
  if (!me) redirect(`${base}/account/login`);
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next !== String(fd.get("confirm") ?? "")) return { errors: { confirm: "The two new passwords do not match." } };
  const problem = passwordProblem(next, me.email);
  if (problem) return { errors: { next: problem } };
  const limit = await rateLimit(`c-pwchange:${me.customerId}`, 5, 15 * 60);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${waitText(limit.retryAfterS)}.` };
  if (!(await changeCustomerPassword(store.id, me.customerId, current, next))) return { errors: { current: "Your current password is not correct." } };
  await revokeUserSessions(me.customerId, me.sid);
  return { ok: "Password changed. Other devices were signed out." };
}
