import Link from "next/link";
import { gmvByStore, listAllStores } from "@/lib/services";
import { Card, PageHeader, SearchInput, StatusPill, Table, Td, Th, formatINR } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Stores" };
const STATUS = { active: "ok", setup: "warn", suspended: "bad" } as const;

export default async function Stores({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const stores = (await listAllStores()).filter((s) => !q || `${s.name} ${s.slug} ${s.settings.email}`.toLowerCase().includes(q.toLowerCase()));
  const gmv = await gmvByStore();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Stores" subtitle={`${stores.length} stores`} />
      <form className="max-w-md"><SearchInput placeholder="Search name, subdomain or email" defaultValue={q} /></form>
      <Card>
        <Table>
          <thead><tr><Th>Store</Th><Th>Owner email</Th><Th>Template</Th><Th>Plan</Th><Th>KYC</Th><Th>Status</Th><Th right>GMV</Th></tr></thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="hover:bg-subtle">
                <Td><Link href={`/admin/stores/${s.id}`} className="font-medium text-teal-700">{s.name}</Link><div className="font-mono text-xs text-muted">{s.customDomain?.status === "verified" ? s.customDomain.host : `${s.slug}.ind2b.com`}</div></Td>
                <Td className="text-muted">{s.settings.email}</Td>
                <Td className="capitalize">{s.templateId}</Td>
                <Td className="capitalize">{s.plan}</Td>
                <Td><StatusPill tone={s.kyc === "verified" ? "ok" : s.kyc === "pending" ? "warn" : s.kyc === "rejected" ? "bad" : "neutral"}>{s.kyc.replace("_", " ")}</StatusPill></Td>
                <Td><StatusPill tone={STATUS[s.status]}>{s.status}</StatusPill></Td>
                <Td right>{formatINR(gmv.get(s.id) ?? 0, { decimals: false })}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
