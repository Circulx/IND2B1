import Link from "next/link";
import { notFound } from "next/navigation";
import { APPS, getStore, getUser, listApps, listOrders, listPlans, listProducts } from "@/lib/services";
import { storeCounts } from "@/lib/services/platform";
import { Button, Card, Input, PageHeader, Select, StatusPill, Table, Td, Th, buttonClass, formatINR } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { ActionButton, CardHead, DetailList, Empty, KYC_TONE, STORE_TONE, fmtDate, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { DeleteStoreForm, EditStoreForm, TransferStoreForm } from "@/components/superadmin/forms";
import { ORDER_STATUS } from "@/lib/types";
import { KYC_KINDS } from "@/lib/kyc";
import { storeLink } from "@/lib/admin";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { decideStoreKycAction, setStorePlanAction, setStoreStatusAction, storeAppAction, storeDomainAction } from "@/actions/superadmin-portal";

export const metadata = { title: "Store" };

/** One store with complete control: details, status, plan, KYC, domain, plugins, ownership and deletion. */
export default async function StoreControl({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [, { id }, sp] = await Promise.all([requireSuperAdminPortal(), params, searchParams]);
  const store = await getStore(id);
  if (!store) notFound();
  const [orders, products, owner, counts, apps, plans] = await Promise.all([listOrders(store.id), listProducts(store.id), getUser(store.ownerId), storeCounts(store.id), listApps({ includeInReview: true }), listPlans()]);
  const here = `/superadmin/stores/${store.id}`;
  const gmv = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned").reduce((a, o) => a + o.totalPaise, 0);
  const statusOf = (appId: string) => apps.find((a) => a.id === appId)?.status ?? "published";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={<Link href="/superadmin/stores" className="text-teal-700">← Stores</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{store.name}<StatusPill tone={STORE_TONE[store.status]!}>{store.status}</StatusPill></span>}
        subtitle={<span className="break-all font-mono text-sm">{store.slug}.ind2b.com</span>}
        actions={<>
          <a href={storeLink(store.slug)} target="_blank" rel="noopener" className={buttonClass("secondary", "md")}><Icon name="eye" size={17} />View storefront</a>
          <Link href={`/superadmin/orders?store=${store.id}`} className={buttonClass("secondary", "md")}><Icon name="receipt" size={17} />Orders</Link>
        </>} />
      <Flash sp={sp} />

      <div className="grid-cols-1 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* ------------------------------------------------ left */}
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="p-4 sm:p-5">
            <DetailList rows={[
              ["Store ID", <span key="i" className="font-mono">{store.id}</span>],
              ["Owner", owner ? <Link key="o" href={`/superadmin/users/${owner.id}`} className="text-teal-700">{owner.name} · {owner.email}</Link> : <span key="o" className="font-mono">{store.ownerId}</span>],
              ["Custom domain", store.customDomain ? `${store.customDomain.host} (${store.customDomain.status})` : "—"],
              ["Category", <span key="c" className="capitalize">{store.category}</span>],
              ["Plan", <span key="p" className="capitalize">{store.plan}</span>],
              ["Template", `${store.templateId} · published v${store.theme.version}${store.draftTheme ? " · unpublished draft" : ""}`],
              ["KYC", <StatusPill key="k" tone={KYC_TONE[store.kyc]!}>{store.kyc.replace("_", " ")}</StatusPill>],
              ["Payments", Object.entries(store.settings.payments).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join(" · ") || "None"],
              ["Contents", `${counts.products} products · ${counts.orders} orders · ${counts.discounts} discount codes · ${counts.shoppers} shopper accounts · ${counts.subscribers} subscribers · ${counts.quotes} quote requests`],
              ["GMV", formatINR(gmv)],
              ["Created", fmtDate(store.createdAt)],
            ]} />
          </Card>

          <EditStoreForm storeId={store.id} values={{ name: store.name, category: store.category, email: store.settings.email, phone: store.settings.phone, address: store.settings.address, state: store.settings.state, gstin: store.settings.gstin ?? "" }} />

          <Card>
            <CardHead title={`Plugins (${store.installedApps.length} installed)`} sub="Install or remove any plugin on this store. Removing a plugin also removes its page sections." />
            <ul className="divide-y divide-line-soft border-t border-line">
              {APPS.map((a) => {
                const installed = store.installedApps.includes(a.id);
                const status = statusOf(a.id);
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-xs text-muted">{a.developer} · {a.pricing}{status !== "published" && ` · ${status.replace("_", " ")}`}</div>
                    </div>
                    {installed
                      ? <ActionButton action={storeAppAction} fields={{ storeId: store.id, appId: a.id, op: "uninstall", back: here }} label="Remove" variant="danger" confirm={`Remove ${a.name} from ${store.name}?`} />
                      : status === "published"
                        ? <ActionButton action={storeAppAction} fields={{ storeId: store.id, appId: a.id, op: "install", back: here }} label="Install" />
                        : <span className="text-xs text-muted">Not available</span>}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHead title="Latest orders" action={<Link href={`/superadmin/orders?store=${store.id}`} className="text-sm font-semibold text-teal-700">All {counts.orders}</Link>} />
            <Table>
              <thead><tr><Th>Order</Th><Th className={hideBelow.sm}>Placed</Th><Th>Status</Th><Th right>Total</Th></tr></thead>
              <tbody>
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id} className="hover:bg-subtle">
                    <Td><Link href={`/superadmin/orders/${o.id}`} className="font-medium text-teal-700">#{o.number}</Link><div className="text-xs text-muted">{o.customer.name}</div></Td>
                    <Td className={`whitespace-nowrap text-muted ${hideBelow.sm}`}>{fmtDateTime(o.createdAt)}</Td>
                    <Td><StatusPill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusPill></Td>
                    <Td right>{formatINR(o.totalPaise)}</Td>
                  </tr>
                ))}
                {orders.length === 0 && <Empty colSpan={4}>No orders yet.</Empty>}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHead title="Products" action={<Link href={`/superadmin/products?store=${store.id}`} className="text-sm font-semibold text-teal-700">Manage {counts.products}</Link>} />
            <Table>
              <thead><tr><Th>Product</Th><Th className={hideBelow.sm}>Collection</Th><Th>Status</Th><Th right>Stock</Th></tr></thead>
              <tbody>
                {products.slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <Td className="font-medium">{p.title}</Td>
                    <Td className={`capitalize text-muted ${hideBelow.sm}`}>{p.collection.replace(/-/g, " ")}</Td>
                    <Td><StatusPill tone={p.status === "active" ? "ok" : "neutral"}>{p.status}</StatusPill></Td>
                    <Td right>{p.variants.reduce((a, v) => a + v.stock, 0)}</Td>
                  </tr>
                ))}
                {products.length === 0 && <Empty colSpan={4}>No products yet.</Empty>}
              </tbody>
            </Table>
          </Card>
        </div>

        {/* ------------------------------------------------ right */}
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="font-semibold">Store status</h2>
            <p className="text-sm text-muted">Suspended stores show an unavailable page and checkout stops. The merchant keeps dashboard access.</p>
            <form action={setStoreStatusAction} className="flex flex-col gap-2.5">
              <input type="hidden" name="storeId" value={store.id} /><input type="hidden" name="back" value={here} />
              <Select name="status" defaultValue={store.status} aria-label="Status">
                <option value="active">Active (live)</option><option value="setup">In setup (not launched)</option><option value="suspended">Suspended</option>
              </Select>
              <Input name="reason" placeholder="Reason (required to suspend; sent to the merchant)" aria-label="Reason" maxLength={500} />
              <Button variant="secondary" className="self-start">Update status</Button>
            </form>
          </Card>

          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="font-semibold">Plan</h2>
            <p className="text-sm text-muted">Takes effect immediately (offline payment, credit, or downgrade).</p>
            <form action={setStorePlanAction} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="storeId" value={store.id} /><input type="hidden" name="back" value={here} />
              <Select name="plan" defaultValue={store.plan} aria-label="Plan">{plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.pricePaise ? `${formatINR(p.pricePaise)}/mo` : "Free"}</option>)}</Select>
              <Button variant="secondary">Save plan</Button>
            </form>
          </Card>

          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">KYC</h2><StatusPill tone={KYC_TONE[store.kyc]!}>{store.kyc.replace("_", " ")}</StatusPill></div>
            {store.kycNote && <p className="rounded-control bg-bad-50 p-2.5 text-sm text-bad">Last note: {store.kycNote}</p>}
            <div className="flex flex-wrap gap-2 text-xs">
              {(store.kycDocs ?? []).map((d) => (
                <a key={d.fileId} href={`/api/kyc/${d.fileId}`} className="rounded-control border border-line px-2.5 py-1.5 font-semibold text-teal-700 hover:bg-teal-50">{KYC_KINDS[d.kind]} ↓</a>
              ))}
              {(store.kycDocs ?? []).length === 0 && <span className="text-muted">No documents uploaded.</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {store.kyc !== "verified" && <ActionButton action={decideStoreKycAction} fields={{ storeId: store.id, decision: "approve", back: here }} label="Approve" variant="primary" confirm={`Mark ${store.name} as KYC verified?`} />}
              {store.kyc !== "not_started" && <ActionButton action={decideStoreKycAction} fields={{ storeId: store.id, decision: "reset", back: here }} label="Reset" confirm="Reset KYC so the merchant submits again?" />}
            </div>
            <form action={decideStoreKycAction} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="storeId" value={store.id} /><input type="hidden" name="decision" value="reject" /><input type="hidden" name="back" value={here} />
              <Input name="note" required placeholder="Reason for rejection" aria-label="Reason for rejection" />
              <Button variant="danger">Reject</Button>
            </form>
          </Card>

          {store.customDomain && (
            <Card className="flex flex-col gap-3 p-4 sm:p-5">
              <h2 className="font-semibold">Custom domain</h2>
              <p className="break-all font-mono text-sm">{store.customDomain.host} <span className="font-sans text-muted">({store.customDomain.status})</span></p>
              <div className="flex flex-wrap gap-2">
                {store.customDomain.status === "pending"
                  ? <ActionButton action={storeDomainAction} fields={{ storeId: store.id, op: "verify", back: here }} label="Mark verified" variant="primary" confirm={`Serve ${store.name} on ${store.customDomain.host}? Check DNS points to IND2B first.`} />
                  : <ActionButton action={storeDomainAction} fields={{ storeId: store.id, op: "unverify", back: here }} label="Set back to pending" />}
                <ActionButton action={storeDomainAction} fields={{ storeId: store.id, op: "remove", back: here }} label="Remove domain" variant="danger" confirm={`Remove ${store.customDomain.host} from this store?`} />
              </div>
            </Card>
          )}

          <TransferStoreForm storeId={store.id} />
          <DeleteStoreForm storeId={store.id} slug={store.slug} />
        </div>
      </div>
    </div>
  );
}
