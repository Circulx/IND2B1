import { listCustomers, listSubscribers } from "@/lib/services";
import { Card, PageHeader, Table, Td, Th, formatINR } from "@/components/ui";
import { requireStore } from "@/lib/merchant";

export const metadata = { title: "Customers" };

export default async function Customers() {
  const { store } = await requireStore();
  const [customers, subscribers] = await Promise.all([listCustomers(store.id), listSubscribers(store.id)]);
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
