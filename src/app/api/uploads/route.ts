import { NextResponse } from "next/server";
import { ImageError, MAX_UPLOAD_BYTES, uploadImage } from "@/lib/media";
import { currentMerchantStore } from "@/lib/merchant";
import { isSameOrigin, rateLimit } from "@/lib/security";

/**
 * POST /api/uploads  (multipart: file, purpose=product|section|logo, alt?)
 * Signed-in store owners only; the image is attached to their active store.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ctx = await currentMerchantStore();
  if (!ctx) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return NextResponse.json({ error: "Images must be 8 MB or smaller." }, { status: 413 });

  const limit = await rateLimit(`upload:${ctx.session.userId}`, 120, 60 * 60);
  if (!limit.ok) return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Send the image as a form upload." }, { status: 400 }); }
  const file = form.get("file");
  const purpose = String(form.get("purpose") ?? "product");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!["product", "section", "logo"].includes(purpose)) return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Images must be 8 MB or smaller." }, { status: 413 });

  try {
    const item = await uploadImage({
      storeId: ctx.store.id, ownerId: ctx.session.userId, purpose: purpose as "product" | "section" | "logo",
      file: Buffer.from(await file.arrayBuffer()), alt: String(form.get("alt") ?? ""),
    });
    return NextResponse.json({ id: item.id, url: item.url, width: item.width, height: item.height });
  } catch (e) {
    if (e instanceof ImageError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("[upload]", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
