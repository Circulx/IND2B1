import type { Metadata } from "next";
import { PortalShell } from "@/components/superadmin/shell";
import { portalNav } from "@/components/superadmin/nav";
import { navCounts } from "@/lib/services/platform";
import { requireSuperAdminPortal } from "@/lib/superadmin";

export const metadata: Metadata = { title: { default: "Control centre", template: "%s · IND2B super admin" }, robots: { index: false, follow: false } };

/** Every page under /superadmin (except sign-in) requires an active super admin session. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdminPortal();
  const counts = await navCounts();
  return <PortalShell groups={portalNav(counts)} user={{ name: session.name, email: session.email }}>{children}</PortalShell>;
}
