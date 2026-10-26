import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffLoginForm } from "@/components/admin/staff-login-form";
import { StaffAuthShell } from "@/components/admin/staff-auth-shell";
import { DEMO_ACCOUNTS } from "@/lib/db/seed";
import { getSession } from "@/lib/auth/server";
import { homeFor } from "@/lib/auth/session";
import { isStaff } from "@/lib/types";

export const metadata: Metadata = { title: { absolute: "Staff sign-in · IND2B admin" }, robots: { index: false, follow: false } };

const showDemo = () => process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true";

/** /admin/login — the only sign-in page for IND2B admins and super admins. */
export default async function StaffLogin({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string; reset?: string }> }) {
  const [sp, session] = await Promise.all([searchParams, getSession()]);
  if (session) redirect(isStaff(session.role) ? "/admin" : homeFor(session.role));
  return (
    <StaffAuthShell>
      <StaffLoginForm next={sp.next} demo={showDemo() ? DEMO_ACCOUNTS.filter((d) => d.area === "staff") : []}
        notice={sp.reset ? "Your password was changed. Sign in with your new password." : sp.expired ? "You were signed out. Please sign in again." : undefined} />
    </StaffAuthShell>
  );
}
