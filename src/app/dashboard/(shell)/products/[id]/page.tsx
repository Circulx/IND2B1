import { notFound } from "next/navigation";
import { getProduct, listCollections } from "@/lib/services";
import { Banner, Button, Card, PageHeader } from "@/components/ui";
import { deleteProductAction } from "@/actions/dashboard";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { requireStore } from "@/lib/merchant";
import { versionKey } from "@/lib/version-key";
import { ProductForm } from "@/components/dashboard/product-form";

export const metadata = { title: "Product" };

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const { store } = await requireStore();
  const isNew = id === "new";
  const product = isNew ? undefined : await getProduct(store.id, id);
  if (!isNew && !product) notFound();
  const collections = (await listCollections(store.id)).map((c) => c.handle);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={<a href="/dashboard/products" className="text-teal-700">← Products</a>} title={product?.title ?? "Add product"} />
      {saved && <Banner tone="ok" icon="check-circle">Product saved.</Banner>}
      <ProductForm
        key={product ? versionKey(product) : "new"}
        productId={product?.id ?? null}
        initial={product}
        collections={collections}
        b2b={store.installedApps.includes("b2b-wholesale")}
        pricesIncludeGst={store.settings.pricesIncludeGst}
      />
      {product && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div><h2 className="font-semibold">Delete product</h2><p className="text-sm text-muted">Removes it from your store. Past orders keep their details.</p></div>
          <form action={deleteProductAction.bind(null, product.id)}>
            <ConfirmSubmit message={`Delete “${product.title}”? This cannot be undone.`}><Button variant="danger" size="sm" icon="trash">Delete product</Button></ConfirmSubmit>
          </form>
        </Card>
      )}
    </div>
  );
}
