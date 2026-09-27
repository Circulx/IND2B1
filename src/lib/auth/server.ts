import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findActiveSession } from "../services/sessions";
import { getUser } from "../services/users";
import { SESSION_COOKIE, verifySession, type Role, type Session } from "./session";

export type ActiveSession = Session & { sid: string };

/**
 * The signed-in user for this request, or null. Checks the cookie signature,
 * that the session still exists in MongoDB (not logged out / revoked), and that
 * the user still exists with the same role. Cached per request.
 */
export const getSession = cache(async (): Promise<ActiveSession | null> => {
  const claims = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const [s, user] = await Promise.all([findActiveSession(claims.sid, claims.userId), getUser(claims.userId)]);
  if (!s || !user || user.role !== claims.role) return null;
  return { userId: user.id, name: user.name, email: user.email, role: user.role, sid: claims.sid };
});

/**
 * Defence in depth: the proxy already blocks requests without a valid cookie,
 * but every layout and Server Action checks again here (proxies can be
 * misconfigured and Server Actions are reachable by POST).
 */
export async function requireRole(role: Role, loginUrl = `/login?next=${role === "admin" ? "/admin" : "/dashboard"}`): Promise<ActiveSession> {
  const s = await getSession();
  if (!s || s.role !== role) redirect(loginUrl);
  return s;
}
