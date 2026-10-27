import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalAuthShell } from "@/components/superadmin/auth-shell";
import { PortalLoginForm } from "@/components/superadmin/forms";
import { DEMO_ACCOUNTS } from "@/lib/db/seed";
import { getSession } from "@/lib/auth/server";
import { portalPath } from "@/lib/superadmin";

export const metadata: Metadata = { title: { absolute: "Super admin sign-in · IND2B" }, robots: { index: false, follow: false } };

const showDemo = () => process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true";

/** /superadmin/login — sign-in page of the super admin control centre. */
export default async function SuperAdminLogin({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string; reset?: string }> }) {
  const [sp, session] = await Promise.all([searchParams, getSession()]);
  if (session?.role === "superadmin") redirect(portalPath(sp.next));
  const demo = showDemo() ? DEMO_ACCOUNTS.find((d) => d.area === "staff" && /super/i.test(d.label)) : undefined;
  const notice = sp.reset ? "Your password was changed. Sign in with your new password."
    : sp.expired ? "You were signed out. Please sign in again."
    : session ? `You are signed in as ${session.email}, which is not a super admin. Signing in here switches accounts.`
    : undefined;
  return (
    <PortalAuthShell>
      <PortalLoginForm next={sp.next} notice={notice} demo={demo} />
    </PortalAuthShell>
  );
}
