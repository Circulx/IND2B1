import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductByHandle } from "@/lib/services";
import { Icon, Img } from "@/components/ui";
import { resolveStore } from "@/lib/storefront";
import { addToCart } from "@/actions/storefront";
import { BuyForm } from "@/components/storefront/buy-form";

export async function generateMetadata({ params }: { params: Promise<{ store: string; handle: string }> }): Promise<Metadata> {
  const { store: s, handle } = await params;
  const { store } = await resolveStore(s);
  const p = await getProductByHandle(store.id, handle);
  return p ? { title: p.title, description: p.description.slice(0, 160) } : {};
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ store: string; handle: string }>; searchParams: Promise<{ soldout?: string }> }) {
  const [{ store: slug, handle }, { soldout }] = await Promise.all([params, searchParams]);
  const { store, base } = await resolveStore(slug);
  const product = await getProductByHandle(store.id, handle);
  if (!product || product.status !== "active") notFound();
  const b2b = store.installedApps.includes("b2b-wholesale");
  const v = product.variants[0]!;
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: product.title, description: product.description, sku: v.sku,
    ...(product.images.length ? { image: product.images.map((i) => i.url) } : {}),
    offers: { "@type": "Offer", priceCurrency: "INR", price: (v.pricePaise / 100).toFixed(2), availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } };

  return (
    <div className="grid gap-10 px-5 py-10 md:grid-cols-2 md:px-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="flex flex-col gap-3">
        <Img src={product.images[0]?.url} alt={product.images[0]?.alt || product.title} label={product.title} className="aspect-[4/5] w-full normal-case tracking-normal" eager />
        {product.images.length > 1 && (
          <div className="grid grid-cols-2 gap-3">{product.images.slice(1, 9).map((im) => <Img key={im.id} src={im.url} alt={im.alt || product.title} className="aspect-square w-full" />)}</div>
        )}
      </div>
      <div className="flex flex-col gap-6">
        <nav className="text-sm text-muted" aria-label="Breadcrumb"><a href={`${base}/`}>Home</a> / <a href={`${base}/collections/${product.collection}`}>{product.collection.replace(/-/g, " ")}</a></nav>
        <h1 className="text-3xl font-semibold leading-tight md:text-4xl" style={{ fontFamily: "var(--store-font)" }}>{product.title}</h1>
        {soldout && <p role="alert" className="text-sm text-bad">That size just sold out.</p>}
        <BuyForm product={product} action={addToCart.bind(null, slug)} b2b={b2b} />
        <div className="flex flex-col gap-2 border-t border-line-soft pt-5 text-sm">
          <p className="leading-relaxed">{product.description}</p>
          <ul className="mt-3 flex flex-col gap-2 text-muted">
            <li className="flex items-center gap-2"><Icon name="truck" size={16} /> Free delivery above ₹{(store.settings.shipping.freeAbovePaise ?? 0) / 100 || "—"}</li>
            {store.installedApps.includes("cod") && <li className="flex items-center gap-2"><Icon name="wallet" size={16} /> Cash on delivery available</li>}
            {store.installedApps.includes("gst-invoice") && <li className="flex items-center gap-2"><Icon name="file" size={16} /> GST invoice with every order</li>}
          </ul>
          {b2b && <a href={`${base}/#rfq`} className="mt-2 font-semibold" style={{ color: "var(--store-primary)" }}>Need a large quantity? Request a quote →</a>}
        </div>
      </div>
    </div>
  );
}
