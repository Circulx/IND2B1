import { NextResponse } from "next/server";
import { deleteMedia } from "@/lib/media";
import { currentMerchantStore } from "@/lib/merchant";
import { isSameOrigin } from "@/lib/security";

/** DELETE /api/uploads/:id — removes an unused image of the active store. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ctx = await currentMerchantStore();
  if (!ctx) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = await params;
  if (!/^med_[A-Za-z0-9_-]{6,20}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const res = await deleteMedia(ctx.store.id, id);
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: 409 });
}
