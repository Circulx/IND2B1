import Link from "next/link";
import { ButtonLink, Logo } from "@/components/ui";
import { getSession } from "@/lib/auth/server";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1280px] items-center gap-8 px-6">
        <Logo />
        <nav className="hidden gap-7 text-[15px] font-medium text-ink-2 md:flex" aria-label="Main">
          <Link href="/templates" className="hover:text-teal-700">Templates</Link>
          <Link href="/plugins" className="hover:text-teal-700">Plugins</Link>
          <Link href="/pricing" className="hover:text-teal-700">Pricing</Link>
        </nav>
        <div className="flex-1" />
        {session ? (
          <Link href={session.role === "admin" ? "/admin" : "/dashboard"} className="text-[15px] font-semibold text-teal-700">Go to dashboard</Link>
        ) : (
          <>
            <Link href="/login" className="text-[15px] font-semibold text-ink-2">Log in</Link>
            <ButtonLink href="/signup">Start free</ButtonLink>
          </>
        )}
      </div>
    </header>
  );
}

const COLS = [
  ["Product", [["Templates", "/templates"], ["Plugins", "/plugins"], ["Pricing", "/pricing"], ["B2B & wholesale", "/plugins#b2b"]]],
  ["Sell with", [["UPI & cards", "/plugins#payments"], ["Cash on delivery", "/plugins#payments"], ["GST invoices", "/plugins#compliance"], ["Shipping", "/plugins#shipping"]]],
  ["Company", [["About", "#"], ["Careers", "#"], ["Contact", "#"], ["Blog", "#"]]],
  ["Legal", [["Terms", "#"], ["Privacy", "#"], ["Refund policy", "#"], ["Grievance officer", "#"]]],
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-ink px-6 pb-8 pt-12 text-[#e3e8ec]">
      <div className="mx-auto grid max-w-[1280px] gap-8 md:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
        <div className="flex flex-col gap-3"><Logo dark /><p className="max-w-xs text-sm text-admin-muted">The easiest way for Indian businesses to build their own online store.</p></div>
        {COLS.map(([t, links]) => (
          <div key={t} className="flex flex-col gap-2.5">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-admin-muted">{t}</div>
            {links.map(([l, h]) => <Link key={l} href={h} className="text-sm hover:text-white">{l}</Link>)}
          </div>
        ))}
      </div>
    </footer>
  );
}
