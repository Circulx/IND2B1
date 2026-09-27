import type { Metadata } from "next";
import { listTemplates } from "@/lib/services";
import { getSession } from "@/lib/auth/server";
import { Logo } from "@/components/ui";
import { StartWizard } from "@/components/site/start-wizard";

export const metadata: Metadata = { title: "Create your store" };

export default async function StartPage({ searchParams }: { searchParams: Promise<{ store?: string; template?: string }> }) {
  const [sp, templates, session] = await Promise.all([searchParams, listTemplates(), getSession()]);
  return (
    <div className="min-h-dvh">
      <header className="flex h-[68px] items-center border-b border-line bg-surface px-6"><Logo /></header>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div><h1 className="text-3xl">Welcome{session ? `, ${session.name.split(" ")[0]}` : ""}! Let&apos;s set up your store</h1><p className="mt-2 text-muted">It takes about a minute. You can change everything later.</p></div>
        <StartWizard templates={templates} initialName={sp.store ?? ""} initialTemplate={sp.template} rootDomain={process.env.ROOT_DOMAIN ?? "ind2b.com"} />
      </div>
    </div>
  );
}
