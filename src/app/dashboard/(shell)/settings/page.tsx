import { PLANS } from "@/lib/services";
import { Banner, Button, Card, PageHeader, StatusPill, formatINR } from "@/components/ui";
import { KycCard } from "@/components/dashboard/kyc-card";
import { LogoCard } from "@/components/dashboard/logo-card";
import { requireStore } from "@/lib/merchant";
import { versionKey } from "@/lib/version-key";
import { changePlan, submitKyc } from "@/actions/dashboard";
import { SettingsForm } from "@/components/dashboard/settings-form";

export const metadata = { title: "Settings" };
export default async function Settings({ searchParams }: { searchParams: Promise<{ kyc?: string; saved?: string }> }) {
  const { kyc, saved } = await searchParams;
  const { store } = await requireStore();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle={`Store ID ${store.id}`} />
      {saved && <Banner tone="ok" icon="check-circle">Settings saved.</Banner>}
      <SettingsForm key={versionKey([store.name, store.settings])} name={store.name} settings={store.settings} />
      <LogoCard logo={store.logo} />
      <KycCard kyc={store.kyc} note={store.kycNote} docs={store.kycDocs ?? []} submitAction={submitKyc} missing={kyc === "missing"} />

      <section id="plan" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Plan</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const current = p.id === store.plan;
            return (
              <Card key={p.id} className={current ? "flex flex-col gap-3 border-teal-700 p-5 ring-1 ring-teal-700" : "flex flex-col gap-3 p-5"}>
                <div className="flex items-center justify-between"><span className="font-semibold">{p.name}</span>{current && <StatusPill tone="teal">Current</StatusPill>}</div>
                <div><span className="font-display text-2xl font-bold">{p.pricePaise ? formatINR(p.pricePaise, { decimals: false }) : "Free"}</span>{p.pricePaise ? <span className="text-sm text-muted"> / month</span> : null}</div>
                <div className="text-xs text-muted">{p.transactionFeePct}% transaction fee</div>
                <ul className="flex flex-col gap-1.5 text-sm">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
                {!current && <form action={changePlan.bind(null, p.id)} className="mt-auto pt-2"><Button size="sm" variant="secondary">Switch to {p.name}</Button></form>}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
