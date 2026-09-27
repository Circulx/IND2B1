import type { Metadata } from "next";
import { SignupForm } from "@/components/site/signup-form";

export const metadata: Metadata = { title: "Create your store" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ store?: string; template?: string }> }) {
  const sp = await searchParams;
  return <SignupForm store={sp.store} template={sp.template} />;
}
