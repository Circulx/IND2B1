import { notFound } from "next/navigation";
import { listQuoteRequests } from "@/lib/services";
import { Card, PageHeader, StatusPill, Table, Td, Th } from "@/components/ui";
import { requireStore } from "@/lib/merchant";
import { setQuoteStatus } from "@/actions/dashboard";

export const metadata = { title: "Quote requests" };
const TONE = { new: "warn", contacted: "info", won: "ok", lost: "neutral" } as const;
const NEXT = { new: ["contacted", "lost"], contacted: ["won", "lost"], won: [], lost: ["new"] } as const;

/** B2B Wholesale plugin: requests from the quote form on the store. */
export default async function Quotes() {
  const { store } = await requireStore();
  if (!store.installedApps.includes("b2b-wholesale")) notFound();
  const rows = await listQuoteRequests(store.id);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Quote requests" subtitle="From the “Request a quote” form on your store. Reply by phone or WhatsApp, then update the status." />
      <Card>
        <Table>
          <thead><tr><Th>Received</Th><Th>Product & quantity</Th><Th>Phone</Th><Th>GSTIN</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id}>
                <Td className="whitespace-nowrap text-muted">{new Date(q.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Td>
                <Td><div className="font-medium">{q.product}</div><div className="text-xs text-muted">Qty: {q.quantity}</div></Td>
                <Td mono><a href={`tel:${q.phone.replace(/[^\d+]/g, "")}`} className="text-teal-700">{q.phone}</a></Td>
                <Td mono>{q.gstin ?? "—"}</Td>
                <Td><StatusPill tone={TONE[q.status]}>{q.status}</StatusPill></Td>
                <Td right><div className="flex justify-end gap-3">
                  {NEXT[q.status].map((n) => <form key={n} action={setQuoteStatus.bind(null, q.id, n)}><button className="font-sans text-[13px] font-semibold capitalize text-teal-700">Mark {n}</button></form>)}
                </div></Td>
              </tr>
            ))}
            {rows.length === 0 && <tr><Td colSpan={6} className="py-10 text-center text-muted">No quote requests yet.</Td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
