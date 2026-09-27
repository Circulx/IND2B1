import Link from "next/link";
import { listProducts } from "@/lib/services";
import { Banner, ButtonLink, Card, ImagePlaceholder, Img, PageHeader, SearchInput, StatusPill, Table, Td, Th, formatINR } from "@/components/ui";
import { requireStore } from "@/lib/merchant";
import { setProductStatus } from "@/actions/dashboard";

export const metadata = { title: "Products" };

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; deleted?: string }> }) {
  const { q = "", deleted } = await searchParams;
  const { store } = await requireStore();
  const all = await listProducts(store.id);
  const rows = all.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || p.variants.some((v) => v.sku.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Products" subtitle={`${all.length} products`} actions={<ButtonLink href="/dashboard/products/new" icon="plus">Add product</ButtonLink>} />
      {deleted && <Banner tone="ok" icon="check-circle">Product deleted.</Banner>}
      {all.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <ImagePlaceholder label="Your products" className="h-28 w-40" />
          <h2 className="text-lg font-semibold">Add your first product</h2>
          <p className="max-w-sm text-sm text-muted">Add a title, price and photos. It appears in your store as soon as you save it as active.</p>
          <ButtonLink href="/dashboard/products/new" icon="plus">Add product</ButtonLink>
        </Card>
      ) : (
        <>
          <form className="max-w-md"><SearchInput placeholder="Search by title or SKU" defaultValue={q} /></form>
          <Card>
            <Table>
              <thead><tr><Th>Product</Th><Th>Status</Th><Th>Collection</Th><Th right>Inventory</Th><Th right>Price</Th><Th /></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const stock = p.variants.reduce((a, v) => a + v.stock, 0);
                  const prices = p.variants.map((v) => v.pricePaise);
                  return (
                    <tr key={p.id} className="hover:bg-subtle">
                      <Td><Link href={`/dashboard/products/${p.id}`} className="flex items-center gap-3"><Img src={p.images[0]?.url} alt={p.title} className="size-11 shrink-0" /><span className="font-medium text-ink">{p.title}</span></Link></Td>
                      <Td><StatusPill tone={p.status === "active" ? "ok" : "neutral"}>{p.status === "active" ? "Active" : "Draft"}</StatusPill></Td>
                      <Td className="capitalize text-muted">{p.collection.replace(/-/g, " ")}</Td>
                      <Td right className={stock <= 5 ? "text-warn" : undefined}>{stock} in stock{p.variants.length > 1 && <div className="font-sans text-[11px] text-muted">{p.variants.length} variants</div>}</Td>
                      <Td right>{Math.min(...prices) === Math.max(...prices) ? formatINR(prices[0]!) : `${formatINR(Math.min(...prices))}+`}</Td>
                      <Td right>
                        <form action={setProductStatus.bind(null, p.id, p.status === "active" ? "draft" : "active")}>
                          <button className="font-sans text-[13px] font-semibold text-teal-700">{p.status === "active" ? "Unpublish" : "Publish"}</button>
                        </form>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
