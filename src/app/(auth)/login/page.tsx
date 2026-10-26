import type { Metadata } from "next";
import { DEMO_ACCOUNTS } from "@/lib/db/seed";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/site/login-form";
import { getSession } from "@/lib/auth/server";
import { homeFor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Log in" };

/** Demo credentials are listed only outside production (or when SHOW_DEMO_ACCOUNTS=true). */
const showDemo = () => process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  // Already signed in: go straight to your own area.
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  const sp = await searchParams;
  return <LoginForm next={sp.next} notice={sp.reset ? "Your password was changed. Log in with your new password." : undefined}
    demo={showDemo() ? DEMO_ACCOUNTS.filter((d) => d.area === "merchant") : []} />;
}
