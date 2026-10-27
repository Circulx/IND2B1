import Link from "next/link";
import { gmvByStore, listAllStores, listPlans } from "@/lib/services";
import { userLabels } from "@/lib/services/platform";
import { Card, PageHeader, StatusPill, Table, Td, Th, formatINR } from "@/components/ui";
import { Empty, FilterBar, KYC_TONE, STORE_TONE, fmtDate, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { requireSuperAdminPortal } from "@/lib/superadmin";

export const metadata = { title: "Stores" };

type SP = { q?: string; status?: string; plan?: string; kyc?: string; ok?: string; error?: string };

/** Every store on the platform, with filters. Open a store for full control. */
export default async function Stores({ searchParams }: { searchParams: Promise<SP> }) {
  const [, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const q = (sp.q ?? "").trim().toLowerCase();
  const all = await listAllStores();
  const stores = all.filter((s) =>
    (!q || `${s.name} ${s.slug} ${s.id} ${s.settings.email} ${s.customDomain?.host ?? ""}`.toLowerCase().includes(q)) &&
    (!sp.status || s.status === sp.status) && (!sp.plan || s.plan === sp.plan) && (!sp.kyc || s.kyc === sp.kyc));
  const [gmv, owners, plans] = await Promise.all([gmvByStore(), userLabels(stores.map((s) => s.ownerId)), listPlans()]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Stores" subtitle={`${stores.length} of ${all.length} stores`} />
      <Flash sp={sp} />
      <FilterBar q={sp.q} placeholder="Search name, subdomain, domain or email" clearHref="/superadmin/stores" selects={[
        { name: "status", label: "Status", value: sp.status, options: [["active", "Active"], ["setup", "In setup"], ["suspended", "Suspended"]] },
        { name: "plan", label: "Plan", value: sp.plan, options: plans.map((p) => [p.id, p.name]) },
        { name: "kyc", label: "KYC", value: sp.kyc, options: [["verified", "Verified"], ["pending", "Pending"], ["rejected", "Rejected"], ["not_started", "Not started"]] },
      ]} />
      <Card>
        <Table>
          <thead><tr><Th>Store</Th><Th className={hideBelow.lg}>Owner</Th><Th className={hideBelow.md}>Plan</Th><Th className={hideBelow.md}>KYC</Th><Th>Status</Th><Th right className={hideBelow.sm}>GMV</Th><Th className={hideBelow.xl}>Created</Th></tr></thead>
          <tbody>
            {stores.map((s) => {
              const owner = owners.get(s.ownerId);
              return (
                <tr key={s.id} className="hover:bg-subtle">
                  <Td>
                    <Link href={`/superadmin/stores/${s.id}`} className="font-medium text-teal-700">{s.name}</Link>
                    <div className="break-all font-mono text-xs text-muted">{s.customDomain?.status === "verified" ? s.customDomain.host : `${s.slug}.ind2b.com`}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5 md:hidden"><span className="text-xs capitalize text-muted">{s.plan}</span><span className="text-xs text-muted">· KYC {s.kyc.replace("_", " ")}</span></div>
                  </Td>
                  <Td className={hideBelow.lg}>{owner ? <><div className="text-sm">{owner.name}</div><div className="text-xs text-muted">{owner.email}</div></> : <span className="font-mono text-xs text-muted">{s.ownerId}</span>}</Td>
                  <Td className={`capitalize ${hideBelow.md}`}>{s.plan}</Td>
                  <Td className={hideBelow.md}><StatusPill tone={KYC_TONE[s.kyc]!}>{s.kyc.replace("_", " ")}</StatusPill></Td>
                  <Td><StatusPill tone={STORE_TONE[s.status]!}>{s.status}</StatusPill></Td>
                  <Td right className={hideBelow.sm}>{formatINR(gmv.get(s.id) ?? 0)}</Td>
                  <Td className={`whitespace-nowrap text-muted ${hideBelow.xl}`}>{fmtDate(s.createdAt)}</Td>
                </tr>
              );
            })}
            {stores.length === 0 && <Empty colSpan={7}>No stores match these filters.</Empty>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
