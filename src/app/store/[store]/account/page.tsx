import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ORDER_STATUS, getCustomerAccount, listCustomerOrders } from "@/lib/services";
import { StatusPill, formatINR } from "@/components/ui";
import { resolveStore } from "@/lib/storefront";
import { getCustomerSession } from "@/lib/auth/customer";
import { changeCustomerPasswordAction, customerLogout, saveCustomerProfile } from "@/actions/customer-auth";
import { CustomerPasswordForm, CustomerProfileForm } from "@/components/storefront/customer-forms";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

/** A signed-in shopper's account on this store: orders, details, password. */
export default async function Account({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store, base } = await resolveStore(slug);
  const me = await getCustomerSession(store.id);
  if (!me) redirect(`${base}/account/login?next=${encodeURIComponent(`${base}/account`)}`);
  const [account, orders] = await Promise.all([getCustomerAccount(store.id, me.customerId), listCustomerOrders(store.id, me.customerId)]);
  if (!account) redirect(`${base}/account/login`);
  const card = "flex flex-col gap-4 rounded-card border border-line bg-white p-6";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--store-font)" }}>Hello, {account.name.split(" ")[0]}</h1><p className="mt-1 text-sm text-muted">{account.email}</p></div>
        <form action={customerLogout.bind(null, slug)}><button className="h-10 rounded-control border border-control px-4 text-sm font-semibold">Sign out</button></form>
      </div>

      <section className={card}>
        <h2 className="text-lg font-semibold">Your orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">No orders yet. Orders you place while signed in appear here. <a href={`${base}/collections/all`} className="font-semibold" style={{ color: "var(--store-primary)" }}>Start shopping →</a></p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <a href={`${base}/orders/${o.id}`} className="font-mono font-semibold" style={{ color: "var(--store-primary)" }}>#{o.number}</a>
                <span className="text-muted">{new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                <span className="flex-1 truncate">{o.lines.map((l) => `${l.title} × ${l.qty}`).join(", ")}</span>
                <StatusPill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusPill>
                <span className="w-24 text-right font-mono">{formatINR(o.totalPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className={card}><CustomerProfileForm action={saveCustomerProfile.bind(null, slug)} name={account.name} phone={account.phone} /></section>
        <section className={card}><CustomerPasswordForm action={changeCustomerPasswordAction.bind(null, slug)} /></section>
      </div>
    </div>
  );
}
