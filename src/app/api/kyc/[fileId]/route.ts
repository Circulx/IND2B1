import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { readKycDocument } from "@/lib/kyc";
import { listStoresForOwner } from "@/lib/services";
import { audit } from "@/lib/audit";
import { isStaff } from "@/lib/types";

/** GET /api/kyc/:fileId — the store owner or IND2B staff (admin, super admin) can download a KYC document. */
export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const doc = await readKycDocument((await params).fileId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isStaff(session.role)) {
    const owned = await listStoresForOwner(session.userId);
    if (!owned.some((s) => s.id === doc.storeId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else {
    await audit(session, "kyc.document_viewed", doc.storeId, { filename: doc.filename });
  }
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `attachment; filename="${doc.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
