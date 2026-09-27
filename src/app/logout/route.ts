import { NextResponse } from "next/server";
import { ACTIVE_STORE_COOKIE, SESSION_COOKIE, cookieOptions, verifySession } from "@/lib/auth/session";
import { revokeSession } from "@/lib/services/sessions";
import { isSameOrigin } from "@/lib/security";

/** POST /logout — ends this device's session (server-side too) and clears the cookies. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const token = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const claims = await verifySession(token ? decodeURIComponent(token) : undefined);
  if (claims) await revokeSession(claims.sid);
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  res.cookies.set(ACTIVE_STORE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
