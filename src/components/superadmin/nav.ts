import type { PortalNavGroup } from "./shell";

/** Navigation of the super admin control centre. Counts highlight work waiting. */
export function portalNav(counts: { kyc: number; plugins: number; unfulfilled: number }): PortalNavGroup[] {
  return [
    { items: [{ label: "Dashboard", href: "/superadmin", icon: "home", exact: true }] },
    {
      title: "Commerce",
      items: [
        { label: "Stores", href: "/superadmin/stores", icon: "store" },
        { label: "Orders", href: "/superadmin/orders", icon: "receipt", count: counts.unfulfilled },
        { label: "Products", href: "/superadmin/products", icon: "box" },
        { label: "Discount codes", href: "/superadmin/discounts", icon: "tag" },
        { label: "Shoppers", href: "/superadmin/shoppers", icon: "user" },
      ],
    },
    {
      title: "Compliance & catalogue",
      items: [
        { label: "KYC verification", href: "/superadmin/kyc", icon: "shield", count: counts.kyc },
        { label: "Plugins", href: "/superadmin/plugins", icon: "layers", count: counts.plugins },
        { label: "Templates", href: "/superadmin/templates", icon: "palette" },
        { label: "Plans & revenue", href: "/superadmin/plans", icon: "rupee" },
      ],
    },
    {
      title: "People & security",
      items: [
        { label: "Users & staff", href: "/superadmin/users", icon: "users" },
        { label: "Active sessions", href: "/superadmin/sessions", icon: "monitor" },
        { label: "Audit log", href: "/superadmin/audit", icon: "file" },
      ],
    },
    {
      title: "Platform",
      items: [
        { label: "System health", href: "/superadmin/system", icon: "settings" },
        { label: "My account", href: "/superadmin/account", icon: "lock" },
      ],
    },
  ];
}
