import { listAllCustomerAccounts } from "@/lib/services";
import { Card, PageHeader, SearchInput, StatusPill, Table, Td, Th } from "@/components/ui";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { requireSuperAdmin, storeLink } from "@/lib/admin";
import { setCustomerStatusAction } from "@/actions/superadmin";

export const metadata = { title: "Shopper accounts" };

/** Super admin: shopper accounts across every store. */
export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [, { q = "" }] = await Promise.all([requireSuperAdmin(), searchParams]);
  const rows = await listAllCustomerAccounts({ q, limit: 500 });
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Shopper accounts" subtitle="Shoppers who registered on a store. Each store has its own accounts; the same email can exist on several stores." />
      <form className="max-w-md"><SearchInput placeholder="Search name, email or store ID" defaultValue={q} /></form>
      <Card>
        <Table>
          <thead><tr><Th>Shopper</Th><Th>Store</Th><Th>Status</Th><Th>Registered</Th><Th>Last sign-in</Th><Th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <Td><div className="font-medium">{c.name}</div><div className="text-xs text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div></Td>
                <Td>{c.storeSlug ? <a href={storeLink(c.storeSlug)} target="_blank" rel="noopener" className="text-teal-700">{c.storeName}</a> : c.storeName}</Td>
                <Td><StatusPill tone={c.status === "active" ? "ok" : "bad"}>{c.status === "active" ? "Active" : "Disabled"}</StatusPill></Td>
                <Td className="whitespace-nowrap text-muted">{new Date(c.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</Td>
                <Td className="whitespace-nowrap text-muted">{c.lastLoginAt ? new Date(c.lastLoginAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</Td>
                <Td right>
                  <form action={setCustomerStatusAction.bind(null, c.id, c.status === "active" ? "disabled" : "active")}>
                    <ConfirmSubmit message={`${c.status === "active" ? "Disable" : "Enable"} ${c.email} on ${c.storeName}?`}>
                      <button className={`font-sans text-[13px] font-semibold ${c.status === "active" ? "text-bad" : "text-teal-700"}`}>{c.status === "active" ? "Disable" : "Enable"}</button>
                    </ConfirmSubmit>
                  </form>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && <tr><Td colSpan={6} className="py-10 text-center text-muted">No shopper accounts{q ? " match" : " yet"}.</Td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
