import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { findActiveSession, revokeSession } from "../services/sessions";
import { getUser } from "../services/users";
import { isStaff } from "../types";
import { SESSION_COOKIE, STAFF_IDLE_TIMEOUT_S, bearerToken, verifySession, type Role, type Session } from "./session";

export type ActiveSession = Session & { sid: string; via: "cookie" | "bearer" };

/**
 * The signed-in platform user (merchant, admin or super admin) for this request, or null.
 *
 * Accepts the session cookie (browsers) or an `Authorization: Bearer <jwt>` header
 * (API clients). Checks, in order: the JWT signature, issuer, audience and expiry;
 * that the server-side session still exists (not logged out or revoked); that the
 * user still exists, is not disabled and still has the role in the token; and, for
 * staff, that the session has not been idle for too long. Cached per request.
 */
export const getSession = cache(async (): Promise<ActiveSession | null> => {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const cookieToken = jar.get(SESSION_COOKIE)?.value;
  let via: ActiveSession["via"] = "cookie";
  let claims = await verifySession(cookieToken);
  if (!claims) {
    claims = await verifySession(bearerToken(h));
    via = "bearer";
  }
  if (!claims) return null;
  const [s, user] = await Promise.all([findActiveSession(claims.sid, claims.userId, "platform"), getUser(claims.userId)]);
  if (!s || !user || user.role !== claims.role || user.status === "disabled") return null;
  if (isStaff(user.role) && Date.now() - s.lastSeenAt.getTime() > STAFF_IDLE_TIMEOUT_S * 1000) {
    await revokeSession(s._id);
    return null;
  }
  return { userId: user.id, name: user.name, email: user.email, role: user.role, sid: claims.sid, via };
});

/**
 * Defence in depth: the proxy already blocks requests without a valid token,
 * but every layout and Server Action checks again here (proxies can be
 * misconfigured and Server Actions are reachable by POST).
 */
export async function requireRole(role: Role, loginUrl = role === "merchant" ? "/login?next=/dashboard" : "/admin/login?next=/admin"): Promise<ActiveSession> {
  return requireAnyRole([role], loginUrl);
}

export async function requireAnyRole(roles: readonly Role[], loginUrl: string): Promise<ActiveSession> {
  const s = await getSession();
  if (!s || !roles.includes(s.role)) redirect(loginUrl);
  return s;
}

/** IND2B staff: admins and super admins. */
export const requireStaff = (loginUrl = "/admin/login?next=/admin") => requireAnyRole(["admin", "superadmin"], loginUrl);

/** Super admins only. Signed-in admins without the role are sent to the admin home, not the login page. */
export async function requireSuperAdmin(): Promise<ActiveSession> {
  const s = await requireStaff();
  if (s.role !== "superadmin") redirect("/admin?denied=1");
  return s;
}
