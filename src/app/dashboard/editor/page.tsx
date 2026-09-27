import { listCollections, listProducts } from "@/lib/services";
import type { SectionContext } from "@/components/sections";
import { requireStore, storeUrl } from "@/lib/merchant";
import { Editor } from "@/components/dashboard/page-builder";

export const metadata = { title: "Customise store" };

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ applied?: string }> }) {
  const { applied } = await searchParams;
  const { store } = await requireStore();
  const [products, collections] = await Promise.all([listProducts(store.id, { activeOnly: true }), listCollections(store.id)]);
  const theme = store.draftTheme ?? store.theme;
  const ctx: SectionContext = {
    store: { id: store.id, name: store.name, slug: store.slug, settings: store.settings, installedApps: store.installedApps, logo: store.logo },
    products, collections, base: "", preview: true, cartCount: 2,
  };
  return (
    <Editor
      initial={{ sections: theme.sections, tokens: theme.tokens }}
      ctx={ctx}
      storeName={store.name}
      liveUrl={storeUrl(store)}
      publishedVersion={store.theme.version}
      hasDraft={Boolean(store.draftTheme)}
      appliedTemplate={applied ? store.templateId : undefined}
    />
  );
}
