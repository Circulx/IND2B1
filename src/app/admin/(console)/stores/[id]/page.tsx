import { Fragment } from "react";
import { notFound } from "next/navigation";
import { getStore, listOrders, listProducts } from "@/lib/services";
import { Button, Card, Input, PageHeader, StatusPill, formatINR } from "@/components/ui";
import { requireAdmin, storeLink } from "@/lib/admin";
import { storeStatusAction } from "@/actions/admin";

export const metadata = { title: "Store" };

export default async function StoreDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const store = await getStore(id);
  if (!store) notFound();
  const [orders, products] = await Promise.all([listOrders(store.id), listProducts(store.id)]);
  const rows: [string, React.ReactNode][] = [
    ["Store ID", <span key="i" className="font-mono">{store.id}</span>], ["Owner user", <span key="o" className="font-mono">{store.ownerId}</span>],
    ["Subdomain", <a key="s" href={storeLink(store.slug)} target="_blank" rel="noopener" className="font-mono text-teal-700">{store.slug}.ind2b.com</a>],
    ["Custom domain", store.customDomain ? `${store.customDomain.host} (${store.customDomain.status})` : "—"],
    ["Category", store.category], ["Plan", store.plan], ["Template", `${store.templateId} · v${store.theme.version}`],
    ["Plugins", store.installedApps.join(", ")], ["GSTIN", store.settings.gstin ?? "—"], ["State", store.settings.state],
    ["Products", products.length], ["Orders", orders.length],
    ["GMV", formatINR(orders.filter((o) => o.status !== "cancelled" && o.status !== "returned").reduce((a, o) => a + o.totalPaise, 0))],
    ["Created", new Date(store.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })],
  ];
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={<a href="/admin/stores" className="text-teal-700">← Stores</a>} title={<span className="flex items-center gap-3">{store.name}<StatusPill tone={store.status === "active" ? "ok" : store.status === "setup" ? "warn" : "bad"}>{store.status}</StatusPill></span>} />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5"><dl className="grid grid-cols-[160px_1fr] gap-y-2.5 text-sm">{rows.map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></Fragment>)}</dl></Card>
        <Card className="flex h-fit flex-col gap-3 p-5">
          <h2 className="font-semibold">{store.status === "suspended" ? "Restore store" : "Suspend store"}</h2>
          <p className="text-sm text-muted">{store.status === "suspended" ? "The storefront comes back online and the merchant can sell again." : "The storefront shows an unavailable page and checkout stops. The merchant keeps dashboard access to fix the issue."}</p>
          <form action={storeStatusAction} className="flex flex-col gap-2.5">
            <input type="hidden" name="storeId" value={store.id} />
            <input type="hidden" name="action" value={store.status === "suspended" ? "restore" : "suspend"} />
            {store.status !== "suspended" && <Input name="reason" placeholder="Reason (sent to the merchant)" required aria-label="Reason" />}
            <Button variant={store.status === "suspended" ? "primary" : "danger"}>{store.status === "suspended" ? "Restore" : "Suspend"}</Button>
          </form>
          <p className="text-xs text-muted">Recorded in the audit log with your name.</p>
        </Card>
      </div>
    </div>
  );
}
