import Link from "next/link";
import { listAllProducts, storeOptions } from "@/lib/services/platform";
import { Card, Img, PageHeader, StatusPill, Table, Td, Th, formatINR } from "@/components/ui";
import { ActionButton, Empty, FilterBar, Pager, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { storeLink } from "@/lib/admin";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { deleteProductAnyAction, setProductStatusAction } from "@/actions/superadmin-portal";

export const metadata = { title: "Products" };

type SP = { q?: string; status?: string; store?: string; page?: string; ok?: string; error?: string };

/** Products across every store: take down (draft) or delete anything that breaks the rules. */
export default async function Products({ searchParams }: { searchParams: Promise<SP> }) {
  const [, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const status = sp.status === "active" || sp.status === "draft" ? sp.status : undefined;
  const store = sp.store && /^st_[A-Za-z0-9_-]{1,60}$/.test(sp.store) ? sp.store : undefined;
  const [{ products, total, page, pages }, stores] = await Promise.all([listAllProducts({ q: sp.q, status, storeId: store, page: Number(sp.page) || 1 }), storeOptions()]);
  const qs = new URLSearchParams(Object.entries({ q: sp.q, status, store, page: sp.page }).filter(([, v]) => v) as [string, string][]).toString();
  const here = `/superadmin/products${qs ? `?${qs}` : ""}`;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Products" subtitle="Every product on every store. Move a product to draft to take it off the storefront, or delete it." />
      <Flash sp={sp} />
      <FilterBar q={sp.q} placeholder="Title, handle, SKU or product ID" clearHref="/superadmin/products" selects={[
        { name: "store", label: "Store", value: store, options: stores.map((s) => [s.id, s.name]) },
        { name: "status", label: "Status", value: status, options: [["active", "Active"], ["draft", "Draft"]] },
      ]} />
      <Card>
        <Table>
          <thead><tr><Th>Product</Th><Th className={hideBelow.md}>Store</Th><Th right className={hideBelow.sm}>Price</Th><Th right className={hideBelow.lg}>Stock</Th><Th className={hideBelow.sm}>Status</Th><Th right>Actions</Th></tr></thead>
          <tbody>
            {products.map((p) => {
              const prices = p.variants.map((v) => v.pricePaise);
              return (
                <tr key={p.id} className="hover:bg-subtle">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Img src={p.images[0]?.url} alt={p.images[0]?.alt ?? p.title} label="" className="hidden size-10 shrink-0 sm:block" />
                      <div className="min-w-0">
                        <a href={`${storeLink(p.storeSlug)}/products/${p.handle}`} target="_blank" rel="noopener" className="font-medium text-teal-700">{p.title}</a>
                        <div className="text-xs text-muted md:hidden">{p.storeName}</div>
                        <div className="text-xs text-muted sm:hidden">{p.status} · {prices.length ? formatINR(Math.min(...prices)) : "—"}</div>
                      </div>
                    </div>
                  </Td>
                  <Td className={hideBelow.md}><Link href={`/superadmin/stores/${p.storeId}`} className="text-teal-700">{p.storeName}</Link></Td>
                  <Td right className={hideBelow.sm}>{prices.length ? formatINR(Math.min(...prices)) : "—"}</Td>
                  <Td right className={hideBelow.lg}>{p.variants.reduce((a, v) => a + v.stock, 0)}</Td>
                  <Td className={hideBelow.sm}><StatusPill tone={p.status === "active" ? "ok" : "neutral"}>{p.status}</StatusPill></Td>
                  <Td right>
                    <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-4">
                      <ActionButton action={setProductStatusAction} fields={{ productId: p.id, status: p.status === "active" ? "draft" : "active", back: here }} label={p.status === "active" ? "Unpublish" : "Publish"} link="teal" />
                      <ActionButton action={deleteProductAnyAction} fields={{ productId: p.id, back: here }} label="Delete" link="bad" confirm={`Delete “${p.title}” from ${p.storeName}? This cannot be undone.`} />
                    </div>
                  </Td>
                </tr>
              );
            })}
            {products.length === 0 && <Empty colSpan={6}>No products match.</Empty>}
          </tbody>
        </Table>
      </Card>
      <Pager page={page} pages={pages} total={total} base="/superadmin/products" params={{ q: sp.q, status, store }} />
    </div>
  );
}
