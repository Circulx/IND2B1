import { PLANS, listAllStores } from "@/lib/services";
import { Card, PageHeader, Table, Td, Th, formatINR } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Plans & fees" };

export default async function Plans() {
  await requireAdmin();
  const stores = await listAllStores();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Plans & fees" subtitle="Changes apply to new billing cycles and are announced to merchants 30 days ahead." />
      <Card>
        <Table>
          <thead><tr><Th>Plan</Th><Th right>Monthly price</Th><Th right>Transaction fee</Th><Th>Includes</Th><Th right>Stores</Th><Th right>MRR</Th></tr></thead>
          <tbody>
            {PLANS.map((p) => {
              const n = stores.filter((s) => s.plan === p.id).length;
              return (
                <tr key={p.id}>
                  <Td className="font-semibold">{p.name}</Td>
                  <Td right>{p.pricePaise ? formatINR(p.pricePaise, { decimals: false }) : "Free"}</Td>
                  <Td right>{p.transactionFeePct}%</Td>
                  <Td className="text-xs text-muted">{p.features.join(" · ")}</Td>
                  <Td right>{n}</Td>
                  <Td right>{formatINR((p.pricePaise ?? 0) * n, { decimals: false })}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
