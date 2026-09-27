import type { NavItem } from "@/components/ui";
import type { Store } from "@/lib/types";

/** Merchant dashboard navigation. Plugin pages appear when the plugin is installed. */
export function dashboardNav(store: Pick<Store, "installedApps">, counts: { toFulfil?: number; newQuotes?: number } = {}): NavItem[] {
  return [
    { label: "Home", href: "/dashboard", icon: "home", exact: true },
    { label: "Orders", href: "/dashboard/orders", icon: "box", ...(counts.toFulfil ? { count: counts.toFulfil } : {}) },
    { label: "Products", href: "/dashboard/products", icon: "tag" },
    { label: "Customers", href: "/dashboard/customers", icon: "users" },
    ...(store.installedApps.includes("b2b-wholesale") ? [{ label: "Quote requests", href: "/dashboard/quotes", icon: "inbox" as const, ...(counts.newQuotes ? { count: counts.newQuotes } : {}) }] : []),
    { label: "Discounts", href: "/dashboard/discounts", icon: "receipt" },
    { label: "Analytics", href: "/dashboard/analytics", icon: "chart" },
    { label: "Online store", href: "/dashboard/online-store", icon: "store" },
    { label: "Plugins", href: "/dashboard/apps", icon: "layers" },
    { label: "Settings", href: "/dashboard/settings", icon: "settings" },
    { label: "Account & security", href: "/dashboard/account", icon: "lock" },
  ];
}
