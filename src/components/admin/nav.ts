import type { NavItem } from "@/components/ui";

/** IND2B admin navigation. */
export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "home", exact: true },
  { label: "Stores", href: "/admin/stores", icon: "store" },
  { label: "KYC queue", href: "/admin/kyc", icon: "shield" },
  { label: "Templates", href: "/admin/templates", icon: "palette" },
  { label: "Plugin review", href: "/admin/apps", icon: "layers" },
  { label: "Plans & fees", href: "/admin/plans", icon: "rupee" },
  { label: "Account & security", href: "/admin/account", icon: "lock" },
];
