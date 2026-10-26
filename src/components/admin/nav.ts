import type { NavItem } from "@/components/ui";
import type { Role } from "@/lib/types";

/** IND2B admin navigation shared by admins and super admins. */
export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "home", exact: true },
  { label: "Stores", href: "/admin/stores", icon: "store" },
  { label: "KYC queue", href: "/admin/kyc", icon: "shield" },
  { label: "Templates", href: "/admin/templates", icon: "palette" },
  { label: "Plugin review", href: "/admin/apps", icon: "layers" },
  { label: "Plans & fees", href: "/admin/plans", icon: "rupee" },
  { label: "Account & security", href: "/admin/account", icon: "lock" },
];

/** Pages only super admins can open. */
export const SUPERADMIN_NAV: NavItem[] = [
  { label: "Users & staff", href: "/admin/users", icon: "users" },
  { label: "Shopper accounts", href: "/admin/customers", icon: "user" },
  { label: "Audit log", href: "/admin/audit", icon: "list" },
];

/** Navigation for the signed-in staff member's role. */
export function adminNav(role: Role): NavItem[] {
  if (role !== "superadmin") return ADMIN_NAV;
  const account = ADMIN_NAV[ADMIN_NAV.length - 1]!;
  return [...ADMIN_NAV.slice(0, -1), ...SUPERADMIN_NAV, account];
}
