import "server-only";
import type { Store } from "../types";
import { PLATFORM_BRAND, type Brand } from "./templates";

/** Absolute URL of the platform (links in emails). */
export const appUrl = (path = "/") => `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}${path}`;

/** Absolute URL of a store page, on its subdomain / custom domain in production or /store/<slug> locally. */
export function absoluteStoreUrl(store: Pick<Store, "slug" | "customDomain">, path = "/") {
  const root = process.env.ROOT_DOMAIN;
  if (!root || root === "localhost") return appUrl(`/store/${store.slug}${path === "/" ? "" : path}`);
  const host = store.customDomain?.status === "verified" ? store.customDomain.host : `${store.slug}.${root}`;
  return `https://${host}${path}`;
}

export const platformBrand = (): Brand => ({ ...PLATFORM_BRAND, siteUrl: appUrl("/") });

/** Shopper emails look like they come from the shop: its name, theme colours and logo. */
export function storeBrand(store: Pick<Store, "name" | "slug" | "customDomain" | "theme" | "logo" | "settings">): Brand {
  const t = store.theme.tokens;
  const logo = store.logo?.url && /^https:\/\//.test(store.logo.url) ? store.logo.url : undefined;
  return {
    name: store.name, primary: t.primary, onPrimary: t.onPrimary, accent: t.accent, logoUrl: logo,
    footer: `${store.name}${store.settings.email ? ` · ${store.settings.email}` : ""} · powered by IND2B`,
    siteUrl: absoluteStoreUrl(store),
  };
}
