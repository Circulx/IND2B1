import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffAuthShell } from "@/components/admin/staff-auth-shell";
import { ResetFlow } from "@/components/auth/reset-flow";
import { PLATFORM_ACCENT } from "@/components/auth/otp";
import { completePasswordReset, requestPasswordReset, resendResetCode } from "@/actions/password-reset";
import { getSession } from "@/lib/auth/server";

export const metadata: Metadata = { title: { absolute: "Reset staff password · IND2B admin" }, robots: { index: false, follow: false } };

/** /admin/forgot-password — staff (admins and super admins) reset their password by emailed code. */
export default async function StaffForgotPassword() {
  if (await getSession()) redirect("/admin");
  return (
    <StaffAuthShell>
      <ResetFlow accent={PLATFORM_ACCENT} strong loginHref="/admin/login"
        intro="Enter your IND2B work email. We'll send a 6-digit code to reset your password. The reset is recorded in the audit log."
        request={requestPasswordReset.bind(null, "staff")} complete={completePasswordReset.bind(null, "staff")} resend={resendResetCode.bind(null, "staff")} />
    </StaffAuthShell>
  );
}
