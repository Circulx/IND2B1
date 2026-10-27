import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { audit, listAudit } from "@/lib/audit";

/** GET /superadmin/audit/export — the audit log (latest 1000, optional ?q=) as CSV. Super admins only. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "superadmin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  const rows = await listAudit({ q, limit: 1000 });
  // Quote every cell; neutralise spreadsheet formulas (=, +, -, @) so a crafted value cannot run in Excel.
  const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const csv = [["at", "actor_id", "actor_name", "action", "target", "detail"], ...rows.map((r) => [r.at, r.actorId, r.actorName, r.action, r.target, r.detail])]
    .map((r) => r.map(cell).join(",")).join("\r\n");
  await audit(s, "audit.exported", "auditlogs", { q, rows: rows.length });
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ind2b-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
