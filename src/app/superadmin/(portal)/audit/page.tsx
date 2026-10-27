import { listAudit } from "@/lib/audit";
import { Card, PageHeader, Table, Td, Th, buttonClass } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { Empty, FilterBar, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { requireSuperAdminPortal } from "@/lib/superadmin";

export const metadata = { title: "Audit log" };

/** Every staff sign-in and decision (append-only), newest first. */
export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const rows = await listAudit({ q: sp.q, limit: 500 });
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Audit log" subtitle="Staff sign-ins and every admin decision, newest first (latest 500)."
        actions={<a href={`/superadmin/audit/export${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ""}`} className={buttonClass("secondary", "md")}><Icon name="download" size={17} />Export CSV</a>} />
      <FilterBar q={sp.q} placeholder="Filter by action, target, staff name or ID" clearHref="/superadmin/audit" />
      <Card>
        <Table>
          <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th className={hideBelow.md}>Target</Th><Th className={hideBelow.lg}>Details</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(r.at)}</Td>
                <Td className="text-sm">{r.actorName}<div className={`font-mono text-[11px] text-muted ${hideBelow.sm}`}>{r.actorId}</div></Td>
                <Td><span className="font-mono text-xs">{r.action}</span><div className="max-w-[180px] truncate font-mono text-[11px] text-muted md:hidden">{r.target}</div></Td>
                <Td mono className={`text-xs ${hideBelow.md}`}>{r.target}</Td>
                <Td className={`max-w-[340px] break-all font-mono text-xs text-muted ${hideBelow.lg}`}>{r.detail}</Td>
              </tr>
            ))}
            {rows.length === 0 && <Empty colSpan={5}>No entries.</Empty>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
