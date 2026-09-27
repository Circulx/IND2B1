import type { Metadata } from "next";
import { listPlans } from "@/lib/services";
import { ButtonLink, Card, Icon, PageHeader, formatINR } from "@/components/ui";

export const metadata: Metadata = { title: "Pricing" };

export default async function Pricing() {
  const plans = await listPlans();
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-6 py-12">
      <PageHeader title="Simple pricing" subtitle="Start free. Pay a monthly plan fee plus a small fee per order. Payment gateway charges are separate." />
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className={`flex flex-col gap-4 p-6 ${p.id === "grow" ? "border-2 border-teal-700" : ""}`}>
            <div className="flex items-center justify-between"><h2 className="text-xl">{p.name}</h2>{p.id === "grow" && <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">Most popular</span>}</div>
            <div><span className="font-display text-4xl font-bold">{formatINR(p.pricePaise ?? 0)}</span><span className="text-muted">/month</span></div>
            <div className="text-sm text-muted">+ {p.transactionFeePct}% per order</div>
            <ul className="flex flex-1 flex-col gap-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-teal-700" />{f}</li>)}</ul>
            <ButtonLink href={`/signup?plan=${p.id}`} variant={p.id === "grow" ? "primary" : "secondary"}>Start with {p.name}</ButtonLink>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted">Prices exclude 18% GST.</p>
    </div>
  );
}
