import { listCustomerAccounts, listCustomers, listSubscribers } from "@/lib/services";
import { StatusPill } from "@/components/ui";
import { Card, PageHeader, Table, Td, Th, formatINR } from "@/components/ui";
import { requireStore } from "@/lib/merchant";

export const metadata = { title: "Customers" };

export default async function Customers() {
  const { store } = await requireStore();
  const [customers, subscribers, accounts] = await Promise.all([listCustomers(store.id), listSubscribers(store.id), listCustomerAccounts(store.id)]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Customers" subtitle={`${customers.length} customers have ordered from ${store.name}`} />
      <Card>
        <Table>
          <thead><tr><Th>Customer</Th><Th>Phone</Th><Th>City</Th><Th right>Orders</Th><Th right>Amount spent</Th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.email}>
                <Td><div className="font-medium">{c.name}</div><div className="text-xs text-muted">{c.email}</div></Td>
                <Td mono>{c.phone}</Td>
                <Td>{c.city}</Td>
                <Td right>{c.orders}</Td>
                <Td right>{formatINR(c.spentPaise)}</Td>
              </tr>
            ))}
            {customers.length === 0 && <tr><Td colSpan={5} className="py-10 text-center text-muted">Customers appear here after their first order.</Td></tr>}
          </tbody>
        </Table>
      </Card>
      <Card>
        <div className="p-5 pb-3"><h2 className="font-semibold">Registered accounts ({accounts.length})</h2><p className="text-sm text-muted">Shoppers who created an account on your store. They see their orders under Account.</p></div>
        <Table>
          <thead><tr><Th>Shopper</Th><Th>Phone</Th><Th>Registered</Th><Th>Last sign-in</Th><Th>Status</Th></tr></thead>
          <tbody>
            {accounts.slice(0, 200).map((a) => (
              <tr key={a.id}>
                <Td><div className="font-medium">{a.name}</div><div className="text-xs text-muted">{a.email}</div></Td>
                <Td mono>{a.phone || "—"}</Td>
                <Td className="text-muted">{new Date(a.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</Td>
                <Td className="text-muted">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"}</Td>
                <Td><StatusPill tone={a.status === "active" ? "ok" : "bad"}>{a.status === "active" ? "Active" : "Disabled"}</StatusPill></Td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><Td colSpan={5} className="py-8 text-center text-muted">Shoppers can create an account from the person icon in your store header.</Td></tr>}
          </tbody>
        </Table>
      </Card>
      <Card>
        <h2 className="p-5 pb-3 font-semibold">Newsletter subscribers ({subscribers.length})</h2>
        <Table>
          <thead><tr><Th>Email</Th><Th>Subscribed</Th></tr></thead>
          <tbody>
            {subscribers.slice(0, 200).map((s) => <tr key={s.email}><Td>{s.email}</Td><Td className="text-muted">{new Date(s.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</Td></tr>)}
            {subscribers.length === 0 && <tr><Td colSpan={2} className="py-8 text-center text-muted">Sign-ups from your store&apos;s newsletter section appear here.</Td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
