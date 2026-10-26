import "server-only";
import { requireStaff, requireSuperAdmin as requireSuper } from "@/lib/auth/server";

/** Any IND2B staff member (admin or super admin). */
export const requireAdmin = () => requireStaff("/admin/login?next=/admin");
/** Super admins only (complete control of the platform). */
export const requireSuperAdmin = () => requireSuper();

export const storeLink = (slug: string) => {
  const root = process.env.ROOT_DOMAIN;
  return !root || root === "localhost" ? `/store/${slug}` : `https://${slug}.${root}`;
};
