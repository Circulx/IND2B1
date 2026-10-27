import Link from "next/link";
import { listAllDiscounts, storeOptions } from "@/lib/services/platform";
import { Card, PageHeader, StatusPill, Table, Td, Th, formatINR } from "@/components/ui";
import { ActionButton, Empty, FilterBar, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { discountAction } from "@/actions/superadmin-portal";

export const metadata = { title: "Discount codes" };

/** Discount codes across every store (switch off abusive codes, delete old ones). */
export default async function Discounts({ searchParams }: { searchParams: Promise<{ q?: string; store?: string; ok?: string; error?: string }> }) {
  const [, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const store = sp.store && /^st_[A-Za-z0-9_-]{1,60}$/.test(sp.store) ? sp.store : undefined;
  const [rows, stores] = await Promise.all([listAllDiscounts({ q: sp.q, storeId: store }), storeOptions()]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Discount codes" subtitle={`${rows.length} codes across all stores`} />
      <Flash sp={sp} />
      <FilterBar q={sp.q} placeholder="Search code" clearHref="/superadmin/discounts" selects={[{ name: "store", label: "Store", value: store, options: stores.map((s) => [s.id, s.name]) }]} />
      <Card>
        <Table>
          <thead><tr><Th>Code</Th><Th className={hideBelow.md}>Store</Th><Th>Value</Th><Th right className={hideBelow.sm}>Uses</Th><Th className={hideBelow.sm}>State</Th><Th right>Actions</Th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={`${d.storeId}:${d.code}`} className="hover:bg-subtle">
                <Td><span className="font-mono font-semibold">{d.code}</span><div className="text-xs text-muted md:hidden">{d.storeName}</div>{!d.active && <div className="mt-1 sm:hidden"><StatusPill tone="neutral">Off</StatusPill></div>}</Td>
                <Td className={hideBelow.md}><Link href={`/superadmin/stores/${d.storeId}`} className="text-teal-700">{d.storeName}</Link></Td>
                <Td>{d.type === "percent" ? `${d.value}% off` : `${formatINR(d.value * 100)} off`}{d.minSubtotalPaise > 0 && <div className="text-xs text-muted">over {formatINR(d.minSubtotalPaise)}</div>}</Td>
                <Td right className={hideBelow.sm}>{d.uses}</Td>
                <Td className={hideBelow.sm}><StatusPill tone={d.active ? "ok" : "neutral"}>{d.active ? "Active" : "Off"}</StatusPill></Td>
                <Td right>
                  <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-4">
                    <ActionButton action={discountAction} fields={{ storeId: d.storeId, code: d.code, op: "toggle" }} label={d.active ? "Switch off" : "Switch on"} link="teal" />
                    <ActionButton action={discountAction} fields={{ storeId: d.storeId, code: d.code, op: "delete" }} label="Delete" link="bad" confirm={`Delete code ${d.code} from ${d.storeName}?`} />
                  </div>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && <Empty colSpan={6}>No discount codes match.</Empty>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
