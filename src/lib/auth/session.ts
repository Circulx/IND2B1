import { jwtVerify, SignJWT } from "jose";
import type { Role, Session } from "../types";

export type { Session };
export type { Role };

/**
 * Session cookie for store owners and the IND2B team.
 *
 * The cookie holds a short signed token (HS256) naming a server-side session
 * (`sid`) stored in MongoDB. The proxy checks the signature only (fast); every
 * page and action then checks the session still exists in the database, so
 * logging out, changing the password or an admin revoking access takes effect
 * immediately. This file has no database imports so src/proxy.ts can use it.
 *
 * In production the cookie is `__Host-` prefixed: Secure, path "/", no Domain,
 * so it can never be set or read by a subdomain (merchants' stores live on
 * subdomains of the same root domain).
 */
const isProd = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = isProd ? "__Host-ind2b_session" : "ind2b_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 12;

export type SessionClaims = Session & { sid: string };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (isProd) throw new Error("SESSION_SECRET must be set (32+ characters)");
    return new TextEncoder().encode("dev-only-secret-change-me-dev-only-secret");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const { userId, name, email, role, sid } = payload as unknown as SessionClaims;
    if (typeof userId !== "string" || typeof sid !== "string" || (role !== "merchant" && role !== "admin")) return null;
    return { userId, name: String(name ?? ""), email: String(email ?? ""), role, sid };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};

/** Where each role lands after sign-in. */
export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : "/dashboard";
}

/** The store a merchant is currently managing in /dashboard (they can own several). */
export const ACTIVE_STORE_COOKIE = isProd ? "__Host-ind2b_store" : "ind2b_store";

/** Only allow same-site relative redirects after login (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n]/.test(next)) return fallback;
  return next;
}
