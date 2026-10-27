import { NextResponse } from "next/server";
import { ACTIVE_STORE_COOKIE, SESSION_COOKIE, cookieOptions, verifySession } from "@/lib/auth/session";
import { revokeSession } from "@/lib/services/sessions";
import { isSameOrigin } from "@/lib/security";

/** POST /superadmin/logout — ends this device's session (server-side too) and returns to the super admin sign-in page. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const token = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const claims = await verifySession(token ? decodeURIComponent(token) : undefined);
  if (claims) await revokeSession(claims.sid);
  const res = new NextResponse(null, { status: 303, headers: { Location: "/superadmin/login" } });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  res.cookies.set(ACTIVE_STORE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}

/** A plain visit to /superadmin/logout just goes to the sign-in page (signing out needs a POST). */
export function GET() {
  return new NextResponse(null, { status: 303, headers: { Location: "/superadmin/login" } });
}
