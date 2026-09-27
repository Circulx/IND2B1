import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listStoresForOwner, type Store } from "@/lib/services";
import { ACTIVE_STORE_COOKIE } from "@/lib/auth/session";
import { getSession, requireRole } from "@/lib/auth/server";

/**
 * Every dashboard page and Server Action calls this. It proves the signed-in
 * merchant owns the active store; all data calls then use store.id.
 */
export async function requireStore() {
  const session = await requireRole("merchant", "/login?next=/dashboard");
  const stores = await listStoresForOwner(session.userId);
  if (stores.length === 0) redirect("/start");
  const activeId = (await cookies()).get(ACTIVE_STORE_COOKIE)?.value;
  const store = stores.find((s) => s.id === activeId) ?? stores[0]!;
  return { session, store, stores };
}

/** Same as requireStore() but returns null instead of redirecting (for API route handlers). */
export async function currentMerchantStore() {
  const session = await getSession();
  if (!session || session.role !== "merchant") return null;
  const stores = await listStoresForOwner(session.userId);
  if (!stores.length) return null;
  const activeId = (await cookies()).get(ACTIVE_STORE_COOKIE)?.value;
  return { session, store: stores.find((s) => s.id === activeId) ?? stores[0]!, stores };
}

/**
 * Public URL of a store. On localhost stores open at /store/<slug> (or <slug>.localhost:3000);
 * in production at <slug>.ROOT_DOMAIN or the merchant's verified custom domain.
 */
export function storeUrl(store: Pick<Store, "slug" | "customDomain">) {
  const root = process.env.ROOT_DOMAIN;
  if (!root || root === "localhost") return `/store/${store.slug}`;
  if (store.customDomain?.status === "verified") return `https://${store.customDomain.host}`;
  return `https://${store.slug}.${root}`;
}

export const storeHostLabel = (store: Pick<Store, "slug" | "customDomain">) =>
  store.customDomain?.status === "verified" ? store.customDomain.host : `${store.slug}.${process.env.ROOT_DOMAIN && process.env.ROOT_DOMAIN !== "localhost" ? process.env.ROOT_DOMAIN : "ind2b.com"}`;
