import { NextResponse } from "next/server";
import { z } from "zod";
import { addQuoteRequest } from "@/lib/services";
import { backTo, resolveStore } from "@/lib/storefront";
import { ipFrom, isSameOrigin, rateLimit } from "@/lib/security";

const schema = z.object({
  product: z.string().trim().min(2).max(300), quantity: z.string().trim().min(1).max(60),
  gstin: z.string().trim().toUpperCase().regex(/^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])?$/).optional(),
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/),
});

/** B2B Wholesale plugin: quote request saved for the merchant (dashboard → Quote requests). */
export async function POST(req: Request, { params }: { params: Promise<{ store: string }> }) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const { store, base } = await resolveStore((await params).store);
  const limit = await rateLimit(`rfq:${store.id}:${ipFrom(req.headers)}`, 10, 60 * 60);
  let ok = false;
  if (limit.ok && store.installedApps.includes("b2b-wholesale")) {
    const f = await req.formData();
    const parsed = schema.safeParse({ product: f.get("product"), quantity: f.get("quantity"), gstin: f.get("gstin") || undefined, phone: f.get("phone") });
    if (parsed.success) { await addQuoteRequest(store.id, parsed.data); ok = true; }
  }
  return new NextResponse(null, { status: 303, headers: { Location: backTo(req, base, { rfq: ok ? "sent" : limit.ok ? "invalid" : "limit" }, "rfq") } });
}
