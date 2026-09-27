import { ProductCard } from "@/components/sections";
import { resolveStore, sectionContext } from "@/lib/storefront";

export default async function CollectionPage({ params, searchParams }: { params: Promise<{ store: string; handle: string }>; searchParams: Promise<{ q?: string; sort?: string }> }) {
  const [{ store: slug, handle }, { q = "", sort = "featured" }] = await Promise.all([params, searchParams]);
  const { store, base } = await resolveStore(slug);
  const ctx = await sectionContext(store, base);
  let items = ctx.products.filter((p) => handle === "all" || p.collection === handle);
  if (q) items = items.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));
  if (sort === "price-asc") items = [...items].sort((a, b) => a.variants[0]!.pricePaise - b.variants[0]!.pricePaise);
  if (sort === "price-desc") items = [...items].sort((a, b) => b.variants[0]!.pricePaise - a.variants[0]!.pricePaise);
  const title = handle === "all" ? "All products" : ctx.collections.find((c) => c.handle === handle)?.title ?? handle;
  return (
    <div className="flex flex-col gap-6 px-5 py-10 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--store-font)" }}>{title}</h1><p className="mt-1 text-sm text-muted">{items.length} products</p></div>
        <form className="flex flex-wrap gap-2">
          <label htmlFor="q" className="sr-only">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search" className="h-11 rounded-control border border-control px-3" />
          <label htmlFor="sort" className="sr-only">Sort</label>
          <select id="sort" name="sort" defaultValue={sort} className="h-11 rounded-control border border-control px-3"><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select>
          <button className="h-11 px-4 font-semibold" style={{ background: "var(--store-primary)", color: "var(--store-on-primary)", borderRadius: "var(--store-radius)" }}>Apply</button>
        </form>
      </div>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Collections">
        {[{ handle: "all", title: "All" }, ...ctx.collections].map((c) => (
          <a key={c.handle} href={`${base}/collections/${c.handle}`} aria-current={c.handle === handle ? "page" : undefined} className="rounded-full border px-3 py-1.5" style={c.handle === handle ? { background: "var(--store-primary)", color: "var(--store-on-primary)", borderColor: "var(--store-primary)" } : { borderColor: "#c3c9c0" }}>{c.title}</a>
        ))}
      </nav>
      {items.length === 0 ? <p className="py-16 text-center text-muted">No products found.</p> : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">{items.map((p) => <ProductCard key={p.id} product={p} ctx={ctx} />)}</div>
      )}
    </div>
  );
}
