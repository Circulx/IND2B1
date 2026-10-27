import { listAllCustomerAccounts } from "@/lib/services";
import { Card, PageHeader, StatusPill, Table, Td, Th } from "@/components/ui";
import { ActionButton, Empty, FilterBar, fmtDate, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { storeLink } from "@/lib/admin";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { shopperAction } from "@/actions/superadmin-portal";

export const metadata = { title: "Shoppers" };

/** Shopper accounts registered on any store. */
export default async function Shoppers({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const [, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const rows = await listAllCustomerAccounts({ q: sp.q, limit: 500 });
  const back = `/superadmin/shoppers${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ""}`;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Shoppers" subtitle="Each store has its own shopper accounts; the same email can exist on several stores. Showing the latest 500." />
      <Flash sp={sp} />
      <FilterBar q={sp.q} placeholder="Search name, email or store ID" clearHref="/superadmin/shoppers" />
      <Card>
        <Table>
          <thead><tr><Th>Shopper</Th><Th className={hideBelow.md}>Store</Th><Th className={hideBelow.sm}>Status</Th><Th className={hideBelow.lg}>Registered</Th><Th className={hideBelow.xl}>Last sign-in</Th><Th right>Actions</Th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-subtle">
                <Td>
                  <div className="font-medium">{c.name}</div>
                  <div className="break-all text-xs text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
                  <div className="text-xs text-muted md:hidden">{c.storeName}</div>
                  {c.status !== "active" && <div className="mt-1 sm:hidden"><StatusPill tone="bad">Disabled</StatusPill></div>}
                </Td>
                <Td className={hideBelow.md}>{c.storeSlug ? <a href={storeLink(c.storeSlug)} target="_blank" rel="noopener" className="text-teal-700">{c.storeName}</a> : c.storeName}</Td>
                <Td className={hideBelow.sm}><StatusPill tone={c.status === "active" ? "ok" : "bad"}>{c.status === "active" ? "Active" : "Disabled"}</StatusPill></Td>
                <Td className={`whitespace-nowrap text-muted ${hideBelow.lg}`}>{fmtDate(c.createdAt)}</Td>
                <Td className={`whitespace-nowrap text-muted ${hideBelow.xl}`}>{fmtDateTime(c.lastLoginAt)}</Td>
                <Td right>
                  <div className="flex flex-col items-end gap-1.5 lg:flex-row lg:justify-end lg:gap-4">
                    <ActionButton action={shopperAction} fields={{ customerId: c.id, op: c.status === "active" ? "disable" : "enable", back }} label={c.status === "active" ? "Disable" : "Enable"} link={c.status === "active" ? "bad" : "teal"} confirm={`${c.status === "active" ? "Disable" : "Enable"} ${c.email} on ${c.storeName}?`} />
                    <ActionButton action={shopperAction} fields={{ customerId: c.id, op: "signout", back }} label="Sign out" link="teal" />
                    <ActionButton action={shopperAction} fields={{ customerId: c.id, op: "delete", back }} label="Delete" link="bad" confirm={`Delete the shopper account ${c.email} on ${c.storeName}? Past orders are kept.`} />
                  </div>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && <Empty colSpan={6}>No shopper accounts{sp.q ? " match" : " yet"}.</Empty>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
