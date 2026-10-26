import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, recordLogin, revokeSession, verifyLogin } from "@/lib/services";
import { SESSION_MAX_AGE_S, bearerToken, signSession, verifySession } from "@/lib/auth/session";
import { ipFrom, rateLimit, waitText } from "@/lib/security";
import { audit } from "@/lib/audit";
import { isStaff } from "@/lib/types";

/**
 * JWT access tokens for API clients (mobile apps, scripts, integrations).
 *
 *   POST   /api/auth/token   { "email": "...", "password": "..." }
 *          → 200 { token, tokenType: "Bearer", expiresIn, user }
 *   DELETE /api/auth/token   Authorization: Bearer <token>   → revokes that token
 *
 * Send the token as `Authorization: Bearer <token>` to /api/* routes. Each token is
 * backed by a server-side session, so it shows under "Signed-in devices" and can be
 * revoked there, by changing the password, or by a super admin.
 */
const body = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(128),
});

const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };

export async function POST(req: Request) {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: "Send JSON: { \"email\": \"…\", \"password\": \"…\" }" }, { status: 415, headers: noStore });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400, headers: noStore });
  const { email, password } = parsed.data;

  const ip = ipFrom(req.headers);
  const [perEmail, perIp] = await Promise.all([rateLimit(`token:email:${email}`, 8, 15 * 60), rateLimit(`token:ip:${ip}`, 40, 15 * 60)]);
  if (!perEmail.ok || !perIp.ok) {
    const wait = Math.max(perEmail.retryAfterS, perIp.retryAfterS);
    return NextResponse.json({ error: `Too many attempts. Try again in ${waitText(wait)}.` }, { status: 429, headers: { ...noStore, "Retry-After": String(wait) } });
  }

  const user = await verifyLogin(email, password);
  if (!user) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401, headers: noStore });
  if (user.status === "disabled") return NextResponse.json({ error: "This account has been disabled." }, { status: 403, headers: noStore });

  const sid = await createSession(user.id, user.role, { ip, userAgent: `API · ${req.headers.get("user-agent") ?? "client"}` });
  const token = await signSession({ userId: user.id, name: user.name, email: user.email, role: user.role, sid });
  await recordLogin(user.id);
  if (isStaff(user.role)) await audit({ userId: user.id, name: user.name, email: user.email, role: user.role }, "auth.api_token_issued", user.id, { ip });
  return NextResponse.json(
    { token, tokenType: "Bearer", expiresIn: SESSION_MAX_AGE_S, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    { headers: noStore },
  );
}

export async function DELETE(req: Request) {
  const claims = await verifySession(bearerToken(req.headers));
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  await revokeSession(claims.sid);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
