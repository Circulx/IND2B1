import { NextResponse } from "next/server";
import { z } from "zod";
import { addSubscriber } from "@/lib/services";
import { backTo, resolveStore } from "@/lib/storefront";
import { ipFrom, isSameOrigin, rateLimit } from "@/lib/security";

/** Newsletter sign-up for this store (merchant sees the list under Customers → Subscribers). */
export async function POST(req: Request, { params }: { params: Promise<{ store: string }> }) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const { store, base } = await resolveStore((await params).store);
  const limit = await rateLimit(`subscribe:${store.id}:${ipFrom(req.headers)}`, 10, 60 * 60);
  const email = z.email().max(254).safeParse(String((await req.formData()).get("email") ?? "").trim());
  if (limit.ok && email.success) await addSubscriber(store.id, email.data);
  return new NextResponse(null, { status: 303, headers: { Location: backTo(req, base, { subscribed: limit.ok && email.success ? "1" : "0" }) } });
}
