import "server-only";
import { redirect } from "next/navigation";
import { getSession, type ActiveSession } from "@/lib/auth/server";

/**
 * Guard for the super admin control centre (/superadmin).
 * The proxy already blocks requests without a super admin token; every page,
 * Server Action and route handler checks again here against the database
 * (session not revoked, account active, role still superadmin).
 */
export const PORTAL = "/superadmin";
export const PORTAL_LOGIN = "/superadmin/login";

export async function requireSuperAdminPortal(next?: string): Promise<ActiveSession> {
  const s = await getSession();
  if (!s || s.role !== "superadmin") redirect(`${PORTAL_LOGIN}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return s;
}

/** Only redirect back inside the portal (prevents open redirects through hidden form fields). */
export function portalPath(raw: unknown, fallback: string = PORTAL) {
  const v = String(raw ?? "");
  if (!/^\/superadmin(\/[A-Za-z0-9_\-./]*)?(\?[A-Za-z0-9_\-=&%.+]*)?$/.test(v) || v.includes("..") || v.startsWith("/superadmin/login")) return fallback;
  return v;
}

/** Appends a flash message key (?ok= or ?error=) to a portal path, replacing any earlier one. */
export function withFlash(path: string, kind: "ok" | "error", key: string) {
  const [base, qs = ""] = path.split("?");
  const p = new URLSearchParams(qs);
  p.delete("ok"); p.delete("error");
  p.set(kind, key);
  return `${base}?${p.toString()}`;
}
