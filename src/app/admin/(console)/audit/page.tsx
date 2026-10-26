import { listAudit } from "@/lib/audit";
import { Card, PageHeader, SearchInput, Table, Td, Th } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/admin";

export const metadata = { title: "Audit log" };

/** Super admin: every recorded staff action (append-only). */
export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [, { q = "" }] = await Promise.all([requireSuperAdmin(), searchParams]);
  const rows = await listAudit({ q, limit: 500 });
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Audit log" subtitle="Staff sign-ins and every admin decision, newest first (latest 500)." />
      <form className="max-w-md"><SearchInput placeholder="Filter by action, target or staff name" defaultValue={q} /></form>
      <Card>
        <Table>
          <thead><tr><Th>When</Th><Th>Staff member</Th><Th>Action</Th><Th>Target</Th><Th>Details</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-muted">{new Date(r.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}</Td>
                <Td>{r.actorName}<div className="font-mono text-xs text-muted">{r.actorId}</div></Td>
                <Td mono>{r.action}</Td>
                <Td mono>{r.target}</Td>
                <Td className="max-w-[320px] break-all font-mono text-xs text-muted">{r.detail}</Td>
              </tr>
            ))}
            {rows.length === 0 && <tr><Td colSpan={5} className="py-10 text-center text-muted">No entries.</Td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
