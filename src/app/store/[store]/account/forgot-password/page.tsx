import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveStore } from "@/lib/storefront";
import { getCustomerSession } from "@/lib/auth/customer";
import { ResetFlow } from "@/components/auth/reset-flow";
import { STORE_ACCENT } from "@/components/auth/otp";
import { customerForgotResend, customerForgotStart, customerResetPassword } from "@/actions/customer-auth";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

/** Shoppers reset their password for this store by emailed code (styled with the store's theme). */
export default async function CustomerForgotPassword({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store, base } = await resolveStore(slug);
  if (await getCustomerSession(store.id)) redirect(`${base}/account`);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-14" style={{ fontFamily: "inherit" }}>
      <div className="rounded-card border border-line bg-white p-6 shadow-sm sm:p-8">
        <ResetFlow accent={STORE_ACCENT} strong={false} loginHref={`${base}/account/login`}
          intro={`Enter the email of your ${store.name} account. We'll send you a 6-digit code to choose a new password.`}
          request={customerForgotStart.bind(null, slug)} complete={customerResetPassword.bind(null, slug)} resend={customerForgotResend.bind(null, slug)} />
      </div>
    </div>
  );
}
