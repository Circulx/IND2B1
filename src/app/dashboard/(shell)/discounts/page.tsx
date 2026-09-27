import { listDiscounts } from "@/lib/services";
import { Card, PageHeader, StatusPill, Table, Td, Th, formatINR } from "@/components/ui";
import { requireStore } from "@/lib/merchant";
import { deleteDiscountAction, toggleDiscountAction } from "@/actions/dashboard";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { DiscountForm } from "@/components/dashboard/discount-form";

export const metadata = { title: "Discounts" };

export default async function Discounts() {
  const { store } = await requireStore();
  const discounts = await listDiscounts(store.id);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Discounts" subtitle="Codes your customers enter at checkout." />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <Table>
            <thead><tr><Th>Code</Th><Th>Discount</Th><Th>Minimum order</Th><Th right>Used</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.code}>
                  <Td mono className="font-semibold">{d.code}</Td>
                  <Td>{d.type === "percent" ? `${d.value}% off` : `${formatINR(d.value, { decimals: false })} off`}</Td>
                  <Td>{d.minSubtotalPaise ? formatINR(d.minSubtotalPaise, { decimals: false }) : "None"}</Td>
                  <Td right>{d.uses}</Td>
                  <Td><StatusPill tone={d.active ? "ok" : "neutral"}>{d.active ? "Active" : "Paused"}</StatusPill></Td>
                  <Td right><div className="flex justify-end gap-4">
                    <form action={toggleDiscountAction.bind(null, d.code)}><button className="font-sans text-[13px] font-semibold text-teal-700">{d.active ? "Pause" : "Activate"}</button></form>
                    <form action={deleteDiscountAction.bind(null, d.code)}><ConfirmSubmit message={`Delete the code ${d.code}?`}><button className="font-sans text-[13px] font-semibold text-bad">Delete</button></ConfirmSubmit></form>
                  </div></Td>
                </tr>
              ))}
              {discounts.length === 0 && <tr><Td colSpan={6} className="py-10 text-center text-muted">No discount codes yet.</Td></tr>}
            </tbody>
          </Table>
        </Card>
        <DiscountForm />
      </div>
    </div>
  );
}
