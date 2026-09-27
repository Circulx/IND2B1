import { listApps, type AppCategory } from "@/lib/services";
import { Banner, Button, Card, Chip, Icon, PageHeader, StatusPill, type IconName } from "@/components/ui";
import Link from "next/link";
import { requireStore } from "@/lib/merchant";
import { installAppAction, uninstallAppAction } from "@/actions/dashboard";

export const metadata = { title: "Plugins" };

const CAT: Record<AppCategory, { label: string; icon: IconName }> = {
  payments: { label: "Payments", icon: "wallet" }, shipping: { label: "Shipping", icon: "truck" }, marketing: { label: "Marketing", icon: "megaphone" },
  sales: { label: "Sales", icon: "cart" }, b2b: { label: "B2B", icon: "building" }, compliance: { label: "Compliance", icon: "file" }, support: { label: "Support", icon: "whatsapp" },
};

export default async function Apps({ searchParams }: { searchParams: Promise<{ cat?: string; error?: string }> }) {
  const { cat, error } = await searchParams;
  const { store } = await requireStore();
  const apps = await listApps();
  const installed = apps.filter((a) => store.installedApps.includes(a.id));
  const shown = apps.filter((a) => !cat || a.category === cat);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plugins" subtitle="Add features to your store. Plugins can add checkout options, page sections and dashboard tools." />
      {error === "plan" && <Banner>The B2B Wholesale plugin is included in the Grow and Pro plans. <a href="/dashboard/settings#plan" className="font-semibold text-teal-700">Upgrade</a></Banner>}
      {error === "payments" && <Banner>Keep at least one payment method. Install Cash on Delivery before removing Razorpay.</Banner>}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Installed ({installed.length})</h2>
        <div className="flex flex-wrap gap-2">{installed.map((a) => <Chip key={a.id} active><Icon name={CAT[a.category].icon} size={14} />{a.name}</Chip>)}</div>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Categories">
        <Link href="/dashboard/apps"><Chip active={!cat}>All</Chip></Link>
        {(Object.keys(CAT) as AppCategory[]).map((c) => <Link key={c} href={`/dashboard/apps?cat=${c}`}><Chip active={cat === c}>{CAT[c].label}</Chip></Link>)}
      </nav>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((a) => {
          const on = store.installedApps.includes(a.id);
          return (
            <Card key={a.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-teal-50 text-teal-700"><Icon name={CAT[a.category].icon} size={20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-xs text-muted">by {a.developer} · ★ {a.rating} · {a.installs.toLocaleString("en-IN")} stores</div>
                </div>
                {on && <StatusPill tone="ok">Installed</StatusPill>}
              </div>
              <p className="text-sm">{a.summary}</p>
              <p className="text-xs text-muted">{a.description}</p>
              {a.sections && <p className="text-xs"><span className="font-semibold text-saffron-700">Adds section:</span> {a.sections.join(", ")}</p>}
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-xs font-medium text-muted">{a.pricing}</span>
                <form action={(on ? uninstallAppAction : installAppAction).bind(null, a.id)}>
                  <Button size="sm" variant={on ? "danger" : "primary"}>{on ? "Uninstall" : "Install"}</Button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted">Developers build plugins with the IND2B Apps SDK (extension points: storefront sections and embeds, checkout payments, order webhooks, product pricing and dashboard pages). IND2B reviews every third-party plugin before it is listed.</p>
    </div>
  );
}
