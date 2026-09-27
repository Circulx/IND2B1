import "server-only";
import { requireRole } from "@/lib/auth/server";

export const requireAdmin = () => requireRole("admin", "/login?next=/admin");
export const storeLink = (slug: string) => {
  const root = process.env.ROOT_DOMAIN;
  return !root || root === "localhost" ? `/store/${slug}` : `https://${slug}.${root}`;
};
