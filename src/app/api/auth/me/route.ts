import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";

/** GET /api/auth/me — the signed-in platform user (session cookie or Bearer token), or 401. */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ user: { id: s.userId, name: s.name, email: s.email, role: s.role }, via: s.via }, { headers: { "Cache-Control": "no-store" } });
}
