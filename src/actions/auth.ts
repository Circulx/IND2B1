"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createUser, passwordProblem, verifyLogin } from "@/lib/services";
import { createSession } from "@/lib/services/sessions";
import { cookieOptions, homeFor, safeNext, signSession, SESSION_COOKIE } from "@/lib/auth/session";
import { ipFrom, rateLimit, waitText } from "@/lib/security";

export type AuthState = { error?: string; errors?: Record<string, string>; values?: Record<string, string> };

async function startSession(user: { id: string; name: string; email: string; role: "merchant" | "admin" }) {
  const h = await headers();
  const sid = await createSession(user.id, user.role, { ip: ipFrom(h), userAgent: h.get("user-agent") ?? "" });
  (await cookies()).set(SESSION_COOKIE, await signSession({ userId: user.id, name: user.name, email: user.email, role: user.role, sid }), cookieOptions);
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email."),
  password: z.string().min(1, "Enter your password.").max(128),
});

export async function logIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = { email: String(formData.get("email") ?? "").slice(0, 254) };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  const { email, password } = parsed.data;

  // Brute-force protection: per account and per network address.
  const ip = ipFrom(await headers());
  const [perEmail, perIp] = await Promise.all([rateLimit(`login:email:${email}`, 8, 15 * 60), rateLimit(`login:ip:${ip}`, 40, 15 * 60)]);
  if (!perEmail.ok || !perIp.ok) return { error: `Too many sign-in attempts. Try again in ${waitText(Math.max(perEmail.retryAfterS, perIp.retryAfterS))}.`, values };

  const user = await verifyLogin(email, password);
  if (!user) return { error: "Email or password is incorrect.", values };
  await startSession(user);

  const fallback = homeFor(user.role);
  let next = safeNext(String(formData.get("next") ?? ""), fallback);
  // Each role goes to its own area.
  if (user.role === "merchant" && next.startsWith("/admin")) next = fallback;
  if (user.role === "admin" && (next.startsWith("/dashboard") || next.startsWith("/start"))) next = fallback;
  redirect(next);
}

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email."),
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}\s?\d{5}$/, "Enter a 10-digit mobile number."),
  password: z.string().max(128),
  consent: z.literal("on", { message: "Please accept the terms to continue." }),
});

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = { name: String(formData.get("name") ?? "").slice(0, 80), email: String(formData.get("email") ?? "").slice(0, 254), phone: String(formData.get("phone") ?? "").slice(0, 20), consent: formData.get("consent") === "on" ? "on" : "" };
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
  const pwErr = passwordProblem(String(formData.get("password") ?? ""), values.email);
  if (pwErr) errors.password ??= pwErr;
  if (!parsed.success || Object.keys(errors).length) return { errors, values };

  const limit = await rateLimit(`signup:ip:${ipFrom(await headers())}`, 10, 60 * 60);
  if (!limit.ok) return { error: `Too many sign-ups from your network. Try again in ${waitText(limit.retryAfterS)}.`, values };

  let user;
  try {
    user = await createUser({ ...parsed.data, role: "merchant" });
  } catch (e) {
    if (e instanceof Error && e.message === "email_taken") return { errors: { email: "An account with this email exists. Log in instead." }, values };
    throw e;
  }
  await startSession(user);
  const store = String(formData.get("store") ?? "").slice(0, 60);
  const template = String(formData.get("template") ?? "").slice(0, 30);
  redirect(`/start?${new URLSearchParams({ ...(store && { store }), ...(template && { template }) })}`);
}
