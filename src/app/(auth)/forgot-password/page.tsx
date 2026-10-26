import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetFlow } from "@/components/auth/reset-flow";
import { PLATFORM_ACCENT } from "@/components/auth/otp";
import { completePasswordReset, requestPasswordReset, resendResetCode } from "@/actions/password-reset";
import { getSession } from "@/lib/auth/server";
import { homeFor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

/** /forgot-password — store owners reset their password by emailed code. */
export default async function ForgotPassword() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  return (
    <div className="w-full max-w-[420px]">
      <ResetFlow accent={PLATFORM_ACCENT} strong={false} loginHref="/login"
        intro="Enter the email you use for your IND2B store. We'll send you a 6-digit code to choose a new password."
        request={requestPasswordReset.bind(null, "merchant")} complete={completePasswordReset.bind(null, "merchant")} resend={resendResetCode.bind(null, "merchant")} />
    </div>
  );
}
