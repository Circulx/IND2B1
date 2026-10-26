import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { isStaff, type Role, type Session } from "../types";

export type { Session };
export type { Role };

/**
 * JWT session tokens for everyone who signs in.
 *
 * A token is a short signed JWT (HS256) that names a server-side session (`sid`,
 * also the JWT `jti`) stored in MongoDB. The proxy checks only the signature
 * (fast, no database); every page, Server Action and API route then checks the
 * session still exists in the database, so logging out, changing the password,
 * disabling an account or a super admin revoking access takes effect immediately.
 *
 * Two kinds of token, told apart by the JWT audience so one can never be used as the other:
 *   platform  aud "ind2b:platform"           merchants (/dashboard) and IND2B staff (/admin)
 *   customer  aud "ind2b:customer:<storeId>" a shopper signed in to ONE store (a token from
 *                                             store A is rejected on store B)
 *
 * Platform tokens travel in an httpOnly cookie (browsers) or an
 * `Authorization: Bearer <jwt>` header (API clients, see /api/auth/token).
 *
 * In production cookies are `__Host-` prefixed: Secure, path "/", no Domain, so
 * they can never be set or read by another subdomain (stores live on subdomains).
 *
 * This file has no database imports so src/proxy.ts can use it.
 */
const isProd = process.env.NODE_ENV === "production";
const ISSUER = "ind2b";
const PLATFORM_AUD = "ind2b:platform";
const customerAud = (storeId: string) => `ind2b:customer:${storeId}`;

export const SESSION_COOKIE = isProd ? "__Host-ind2b_session" : "ind2b_session";
/** Platform sign-in lifetime (merchants and staff). */
export const SESSION_MAX_AGE_S = 60 * 60 * 12;
/** Staff are signed out after this long without any activity. */
export const STAFF_IDLE_TIMEOUT_S = 60 * 60 * 2;
/** Shoppers stay signed in to a store for 30 days. */
export const CUSTOMER_SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

export type SessionClaims = Session & { sid: string };
export type CustomerClaims = { customerId: string; storeId: string; name: string; email: string; sid: string };

const enc = (s: string) => new TextEncoder().encode(s);

/** Signing key plus, during a key rotation, the previous key (verify only). */
function keys() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (isProd) throw new Error("SESSION_SECRET must be set (32+ characters)");
    return { current: enc("dev-only-secret-change-me-dev-only-secret"), previous: undefined };
  }
  const prev = process.env.SESSION_SECRET_PREVIOUS;
  return { current: enc(s), previous: prev && prev.length >= 32 ? enc(prev) : undefined };
}

async function verifyJwt(token: string, audience: string): Promise<JWTPayload | null> {
  const { current, previous } = keys();
  for (const key of previous ? [current, previous] : [current]) {
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], issuer: ISSUER, audience, clockTolerance: 5 });
      return payload;
    } catch { /* try the next key */ }
  }
  return null;
}

/* ------------------------------------------------------------------ platform (merchants + staff) */
export async function signSession(claims: SessionClaims) {
  return new SignJWT({ name: claims.name, email: claims.email, role: claims.role, sid: claims.sid })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(PLATFORM_AUD)
    .setSubject(claims.userId)
    .setJti(claims.sid)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(keys().current);
}

export async function verifySession(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token || token.length > 4096) return null;
  const payload = await verifyJwt(token, PLATFORM_AUD);
  if (!payload) return null;
  const { sub, name, email, role, sid } = payload as JWTPayload & { name?: unknown; email?: unknown; role?: unknown; sid?: unknown };
  if (typeof sub !== "string" || typeof sid !== "string" || (role !== "merchant" && role !== "admin" && role !== "superadmin")) return null;
  return { userId: sub, name: String(name ?? ""), email: String(email ?? ""), role, sid };
}

/* ------------------------------------------------------------------ shoppers (one store) */
export async function signCustomerToken(claims: CustomerClaims) {
  return new SignJWT({ name: claims.name, email: claims.email, sid: claims.sid, store: claims.storeId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(customerAud(claims.storeId))
    .setSubject(claims.customerId)
    .setJti(claims.sid)
    .setIssuedAt()
    .setExpirationTime(`${CUSTOMER_SESSION_MAX_AGE_S}s`)
    .sign(keys().current);
}

export async function verifyCustomerToken(token: string | undefined | null, storeId: string): Promise<CustomerClaims | null> {
  if (!token || token.length > 4096) return null;
  const payload = await verifyJwt(token, customerAud(storeId));
  if (!payload) return null;
  const { sub, name, email, sid, store } = payload as JWTPayload & { name?: unknown; email?: unknown; sid?: unknown; store?: unknown };
  if (typeof sub !== "string" || typeof sid !== "string" || store !== storeId) return null;
  return { customerId: sub, storeId, name: String(name ?? ""), email: String(email ?? ""), sid };
}

/** One cookie per store, so a shopper can be signed in to several stores on the same host (/store/<slug> paths). */
export const customerCookieName = (storeId: string) => `${isProd ? "__Host-" : ""}ind2b_c_${storeId.replace(/[^A-Za-z0-9_-]/g, "")}`;

/* ------------------------------------------------------------------ helpers */
export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};
export const customerCookieOptions = { ...cookieOptions, maxAge: CUSTOMER_SESSION_MAX_AGE_S };

/** The JWT from an `Authorization: Bearer …` header, if any. */
export function bearerToken(h: Headers): string | undefined {
  const m = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/.exec(h.get("authorization") ?? "");
  return m?.[1];
}

/** Where each role lands after sign-in. */
export function homeFor(role: Role) {
  return isStaff(role) ? "/admin" : "/dashboard";
}

/** Where each role signs in. Staff use their own page at /admin/login. */
export function loginPathFor(role: Role | undefined) {
  return isStaff(role) ? "/admin/login" : "/login";
}

/** The store a merchant is currently managing in /dashboard (they can own several). */
export const ACTIVE_STORE_COOKIE = isProd ? "__Host-ind2b_store" : "ind2b_store";

/** Only allow same-site relative redirects after login (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n\t]/.test(next) || next.length > 512) return fallback;
  return next;
}
