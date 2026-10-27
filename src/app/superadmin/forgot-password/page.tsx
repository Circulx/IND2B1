import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalAuthShell } from "@/components/superadmin/auth-shell";
import { ResetFlow } from "@/components/auth/reset-flow";
import { PLATFORM_ACCENT } from "@/components/auth/otp";
import { requestPasswordReset, resendResetCode } from "@/actions/password-reset";
import { superAdminCompleteReset } from "@/actions/superadmin-portal";
import { getSession } from "@/lib/auth/server";

export const metadata: Metadata = { title: { absolute: "Reset password · IND2B super admin" }, robots: { index: false, follow: false } };

/** /superadmin/forgot-password — the staff reset flow (emailed 6-digit code), returning to /superadmin/login. */
export default async function SuperAdminForgotPassword() {
  const session = await getSession();
  if (session?.role === "superadmin") redirect("/superadmin");
  return (
    <PortalAuthShell>
      <ResetFlow accent={PLATFORM_ACCENT} strong loginHref="/superadmin/login"
        intro="Enter your IND2B work email. We'll send a 6-digit code to reset your password. The reset is recorded in the audit log."
        request={requestPasswordReset.bind(null, "staff")} complete={superAdminCompleteReset} resend={resendResetCode.bind(null, "staff")} />
    </PortalAuthShell>
  );
}
