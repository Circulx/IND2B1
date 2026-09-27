import type { Metadata } from "next";
import { SectionView, themeStyle, visibleSections } from "@/components/sections";
import { resolveStore, sectionContext } from "@/lib/storefront";

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  const { store } = await resolveStore((await params).store);
  return { title: { default: store.name, template: `%s · ${store.name}` }, description: `Shop ${store.name} online.` };
}

/**
 * Store chrome: the theme's announcement bar and header on top, footer at the
 * bottom, plus app embeds (e.g. WhatsApp button) on every page.
 */
export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ store: string }> }) {
  const { store, base } = await resolveStore((await params).store);
  const ctx = await sectionContext(store, base);
  const sections = visibleSections(store.theme, store.installedApps);
  const top = sections.filter((s) => s.type === "announcement" || s.type === "header");
  const footer = sections.filter((s) => s.type === "footer");
  const embedWhatsApp = store.installedApps.includes("whatsapp-chat") && !sections.some((s) => s.type === "whatsapp-button");
  return (
    <div style={themeStyle(store.theme.tokens)} className="@container flex min-h-dvh flex-col">
      {top.map((s) => <SectionView key={s.id} section={s} ctx={ctx} />)}
      <main className="flex-1">{children}</main>
      {footer.map((s) => <SectionView key={s.id} section={s} ctx={ctx} />)}
      {embedWhatsApp && <SectionView section={{ id: "embed-wa", type: "whatsapp-button", settings: {} }} ctx={ctx} />}
    </div>
  );
}
