import Link from "next/link";
import { listAllStores, listPlans } from "@/lib/services";
import { Button, Card, KpiCard, PageHeader, Select, Table, Td, Th, formatINR, formatINRCompact } from "@/components/ui";
import { CardHead, Empty, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { PlanForm } from "@/components/superadmin/forms";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { setStorePlanAction } from "@/actions/superadmin-portal";

export const metadata = { title: "Plans & revenue" };

/** Plans, subscription revenue, and a quick plan change for any store. */
export default async function Plans({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const [stores, PLANS] = await Promise.all([listAllStores(), listPlans()]);
  const live = stores.filter((s) => s.status !== "suspended");
  const mrr = live.reduce((a, s) => a + (PLANS.find((p) => p.id === s.plan)?.pricePaise ?? 0), 0);
  const paid = live.filter((s) => (PLANS.find((p) => p.id === s.plan)?.pricePaise ?? 0) > 0).length;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Plans & revenue" subtitle="Plans are stored in MongoDB. Edit a plan below and every pricing page, merchant settings page and admin view uses the new values." />
      <Flash sp={sp} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="MRR" value={formatINRCompact(mrr)} hint="Live stores on paid plans" icon="rupee" />
        <KpiCard label="ARR (run-rate)" value={formatINRCompact(mrr * 12)} icon="chart-line" />
        <KpiCard label="Paying stores" value={paid} hint={`of ${live.length} live`} icon="store" />
        <KpiCard label="Suspended" value={stores.length - live.length} hint="Not billed" icon="alert" />
      </div>
      <Card>
        <Table>
          <thead><tr><Th>Plan</Th><Th right>Price / month</Th><Th right className={hideBelow.sm}>Txn fee</Th><Th className={hideBelow.lg}>Includes</Th><Th right>Stores</Th><Th right className={hideBelow.sm}>MRR</Th></tr></thead>
          <tbody>
            {PLANS.map((p) => {
              const n = live.filter((s) => s.plan === p.id).length;
              return (
                <tr key={p.id}>
                  <Td className="font-semibold">{p.name}</Td>
                  <Td right>{p.pricePaise ? formatINR(p.pricePaise) : "Free"}</Td>
                  <Td right className={hideBelow.sm}>{p.transactionFeePct}%</Td>
                  <Td className={`text-xs text-muted ${hideBelow.lg}`}>{p.features.join(" · ")}</Td>
                  <Td right>{n}</Td>
                  <Td right className={hideBelow.sm}>{formatINR((p.pricePaise ?? 0) * n)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PLANS.map((p) => <PlanForm key={p.id} plan={p} stores={live.filter((s) => s.plan === p.id).length} />)}
      </div>
      <Card>
        <CardHead title="Change a store's plan" sub="Takes effect immediately and is written to the audit log." />
        <Table>
          <thead><tr><Th>Store</Th><Th className={hideBelow.sm}>Status</Th><Th right>Plan</Th></tr></thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id}>
                <Td><Link href={`/superadmin/stores/${s.id}`} className="font-medium text-teal-700">{s.name}</Link><div className="font-mono text-xs text-muted">{s.slug}</div></Td>
                <Td className={`capitalize text-muted ${hideBelow.sm}`}>{s.status}</Td>
                <Td right>
                  <form action={setStorePlanAction} className="flex justify-end gap-2">
                    <input type="hidden" name="storeId" value={s.id} /><input type="hidden" name="back" value="/superadmin/plans" />
                    <Select name="plan" defaultValue={s.plan} aria-label={`Plan for ${s.name}`} className="h-9 w-28 font-sans sm:w-36">{PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                    <Button size="sm" variant="secondary">Save</Button>
                  </form>
                </Td>
              </tr>
            ))}
            {stores.length === 0 && <Empty colSpan={3}>No stores yet.</Empty>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
