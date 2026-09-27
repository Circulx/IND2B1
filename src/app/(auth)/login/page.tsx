import type { Metadata } from "next";
import { DEMO_ACCOUNTS } from "@/lib/db/seed";
import { LoginForm } from "@/components/site/login-form";

export const metadata: Metadata = { title: "Log in" };

/** Demo credentials are listed only outside production (or when SHOW_DEMO_ACCOUNTS=true). */
const showDemo = () => process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <LoginForm next={(await searchParams).next} demo={showDemo() ? DEMO_ACCOUNTS : []} />;
}
