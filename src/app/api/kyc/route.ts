import { NextResponse } from "next/server";
import { KYC_KINDS, KYC_MAX_BYTES, saveKycDocument, type KycKind } from "@/lib/kyc";
import { currentMerchantStore } from "@/lib/merchant";
import { isSameOrigin, rateLimit } from "@/lib/security";

/** POST /api/kyc (multipart: kind=pan|bank|gst, file) — PDF, JPG or PNG up to 5 MB. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ctx = await currentMerchantStore();
  if (!ctx) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (ctx.store.kyc === "verified") return NextResponse.json({ error: "Your business is already verified." }, { status: 409 });
  if (Number(req.headers.get("content-length") ?? 0) > KYC_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "Files must be 5 MB or smaller." }, { status: 413 });
  const limit = await rateLimit(`kyc:${ctx.session.userId}`, 30, 60 * 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Send the document as a form upload." }, { status: 400 }); }
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!(kind in KYC_KINDS)) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > KYC_MAX_BYTES) return NextResponse.json({ error: "Files must be 5 MB or smaller." }, { status: 413 });
  try {
    const doc = await saveKycDocument(ctx.store.id, kind as KycKind, file.name, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, doc });
  } catch (e) {
    if (e instanceof Error && e.message === "kyc_type") return NextResponse.json({ error: "Upload a PDF, JPG or PNG file." }, { status: 422 });
    console.error("[kyc]", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
