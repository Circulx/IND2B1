import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveStore } from "@/lib/storefront";
import { getCustomerSession } from "@/lib/auth/customer";
import { customerRegister, customerResendRegistrationCode, customerVerifyRegistration } from "@/actions/customer-auth";
import { CustomerRegisterForm } from "@/components/storefront/customer-forms";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function CustomerRegister({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ next?: string }> }) {
  const [{ store: slug }, { next }] = await Promise.all([params, searchParams]);
  const { store, base } = await resolveStore(slug);
  if (await getCustomerSession(store.id)) redirect(`${base}/account`);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-14">
      <div><h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--store-font)" }}>Create your account</h1><p className="mt-1.5 text-sm text-muted">Track your orders and check out faster. Your account works on {store.name} only.</p></div>
      <CustomerRegisterForm action={customerRegister.bind(null, slug)} verify={customerVerifyRegistration.bind(null, slug)} resend={customerResendRegistrationCode.bind(null, slug)} next={next} loginHref={`${base}/account/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} />
    </div>
  );
}
