import { TEMPLATES, listCollections, listProducts, getStoreBySlug } from "@/lib/services";
import type { SectionContext } from "@/components/sections";
import { Banner, Button, ButtonLink, Card, Chip, Icon, PageHeader, StatusPill } from "@/components/ui";
import { ThemeThumb } from "@/components/dashboard/theme-thumb";
import { requireStore, storeUrl } from "@/lib/merchant";
import { applyTemplateAction, removeDomain } from "@/actions/dashboard";
import { DomainForm } from "@/components/dashboard/domain-form";

export const metadata = { title: "Online store" };

export default async function OnlineStore({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { store } = await requireStore();
  let products = await listProducts(store.id, { activeOnly: true });
  let collections = await listCollections(store.id);
  if (products.length === 0) {
    // Preview templates with sample products until the merchant adds their own.
    const sample = await getStoreBySlug("priyahandlooms");
    if (sample) { products = await listProducts(sample.id, { activeOnly: true }); collections = await listCollections(sample.id); }
  }
  const ctx: SectionContext = { store: { id: store.id, name: store.name, slug: store.slug, settings: store.settings, installedApps: store.installedApps, logo: store.logo }, products, collections, base: "" };
  const current = TEMPLATES.find((t) => t.id === store.templateId);
  const subdomain = `${store.slug}.ind2b.com`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Online store" subtitle="Your theme, templates and domain." actions={<ButtonLink href={storeUrl(store)} external variant="secondary" icon="eye">View store</ButtonLink>} />
      {error === "premium" && <Banner>Premium templates need the Pro plan. <a href="/dashboard/settings#plan" className="font-semibold text-teal-700">Upgrade</a></Banner>}

      <Card className="grid gap-5 p-5 md:grid-cols-[1.3fr_1fr]">
        <ThemeThumb theme={store.theme} ctx={ctx} height={300} scale={0.36} />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{current?.name ?? "Custom"} theme</h2>
            <StatusPill tone="ok">Live</StatusPill>
            {store.draftTheme && <StatusPill tone="warn">Unpublished changes</StatusPill>}
          </div>
          <p className="text-sm text-muted">Version {store.theme.version} · {store.theme.sections.length} sections</p>
          <p className="text-sm">{current?.tagline}</p>
          <div className="mt-auto flex flex-wrap gap-2.5">
            <ButtonLink href="/dashboard/editor" icon="palette">Customise</ButtonLink>
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <div><h2 className="text-lg font-semibold">Template library</h2><p className="text-sm text-muted">Switching loads the template as a draft in the editor. Your products, orders and settings stay as they are.</p></div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => (
            <Card key={t.id} className="flex flex-col gap-3 p-3.5">
              <ThemeThumb theme={{ templateId: t.id, version: 1, tokens: t.tokens, sections: t.sections }} ctx={ctx} height={220} scale={0.26} />
              <div className="flex items-center gap-2 px-1">
                <span className="font-semibold">{t.name}</span>
                {t.id === store.templateId && <Chip active>Current</Chip>}
                {!t.free && <StatusPill tone="teal" dot={false}>Pro</StatusPill>}
              </div>
              <p className="px-1 text-sm text-muted">{t.tagline}</p>
              <form action={applyTemplateAction.bind(null, t.id)} className="px-1 pb-1">
                <Button size="sm" variant="secondary" disabled={t.id === store.templateId}>{t.id === store.templateId ? "In use" : "Try this template"}</Button>
              </form>
            </Card>
          ))}
        </div>
      </section>

      <Card className="flex flex-col gap-4 p-5" id="domains">
        <h2 className="text-lg font-semibold">Domains</h2>
        <div className="flex items-center gap-3 rounded-control border border-line p-3.5">
          <Icon name="globe" className="text-teal-700" />
          <div className="flex-1"><div className="font-mono text-sm">{subdomain}</div><div className="text-xs text-muted">Free IND2B address · always works</div></div>
          <StatusPill tone="ok">Connected</StatusPill>
        </div>
        {store.customDomain ? (
          <div className="flex flex-wrap items-center gap-3 rounded-control border border-line p-3.5">
            <Icon name="globe" className="text-teal-700" />
            <div className="flex-1"><div className="font-mono text-sm">{store.customDomain.host}</div>
              <div className="text-xs text-muted">{store.customDomain.status === "verified" ? "Primary domain · SSL active" : <>Add a CNAME record for <span className="font-mono">{store.customDomain.host}</span> pointing to <span className="font-mono">stores.ind2b.com</span>. We check it every few minutes and issue SSL automatically.</>}</div></div>
            <StatusPill tone={store.customDomain.status === "verified" ? "ok" : "warn"}>{store.customDomain.status === "verified" ? "Verified" : "Waiting for DNS"}</StatusPill>
            <form action={removeDomain}><button className="text-[13px] font-semibold text-bad">Remove</button></form>
          </div>
        ) : store.plan === "starter" ? (
          <p className="text-sm text-muted">Connect your own domain (like www.yourbrand.in) on the Grow or Pro plan. <a href="/dashboard/settings#plan" className="font-semibold text-teal-700">See plans</a></p>
        ) : <DomainForm />}
      </Card>
    </div>
  );
}
