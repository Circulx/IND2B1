import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveStore } from "@/lib/storefront";
import { getCustomerSession } from "@/lib/auth/customer";
import { customerLogin } from "@/actions/customer-auth";
import { CustomerLoginForm } from "@/components/storefront/customer-forms";
import { DEMO_ACCOUNTS } from "@/lib/db/seed";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const demoShopper = (storeId: string) =>
  (process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true") && storeId === "st_priya"
    ? DEMO_ACCOUNTS.find((d) => d.area === "shopper") : undefined;

export default async function CustomerLogin({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ next?: string; reset?: string }> }) {
  const [{ store: slug }, { next, reset }] = await Promise.all([params, searchParams]);
  const { store, base } = await resolveStore(slug);
  if (await getCustomerSession(store.id)) redirect(`${base}/account`);
  const demo = demoShopper(store.id);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-14">
      <div><h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--store-font)" }}>Sign in</h1><p className="mt-1.5 text-sm text-muted">to your {store.name} account to track orders and check out faster.</p></div>
      <CustomerLoginForm action={customerLogin.bind(null, slug)} next={next} forgotHref={`${base}/account/forgot-password`}
        notice={reset ? "Your password was changed. Sign in with your new password." : undefined} registerHref={`${base}/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
        demo={demo ? { email: demo.email, password: demo.password } : undefined} />
    </div>
  );
}
