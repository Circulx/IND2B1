import Link from "next/link";
import { listApps, listPlans, listTemplates } from "@/lib/services";
import { ButtonLink, Card, Eyebrow, Icon, StatusPill, formatINR, type IconName } from "@/components/ui";
import { TemplateThumb } from "@/components/site/template-thumb";

export const revalidate = 3600;

const STEPS: [string, string][] = [
  ["Name your store", "Pick your brand name and get yourname.ind2b.com instantly. Connect your own domain any time."],
  ["Choose a template", "Start from a template made for your kind of business, then edit every section with drag and drop."],
  ["Add products and sell", "Upload products, switch on UPI, cards and COD, and start taking orders the same day."],
];

const FEATURES: [IconName, string, string][] = [
  ["palette", "Templates you can edit", "Change text, colours, fonts and sections without writing code."],
  ["wallet", "UPI, cards & COD", "Razorpay checkout and cash on delivery, settled to your bank."],
  ["file", "GST invoices", "Tax invoices with CGST/SGST or IGST, and e-invoicing when you need it."],
  ["truck", "Shipping built in", "Courier rates, labels and tracking with Shiprocket."],
  ["whatsapp", "WhatsApp updates", "Order and delivery messages your customers actually read."],
  ["globe", "Your own domain", "Use yourname.ind2b.com or connect www.yourbrand.in with free SSL."],
  ["layers", "Plugins", "Add reviews, loyalty, abandoned-cart recovery and more in one click."],
  ["building", "B2B when you need it", "Quote requests, bulk pricing and trade accounts as an add-on."],
];

export default async function Landing() {
  const [templates, apps, plans] = await Promise.all([listTemplates(), listApps(), listPlans()]);
  return (
    <>
      <section className="bg-surface">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="flex flex-col gap-6">
            <Eyebrow className="text-saffron-700">Online store builder · made for India</Eyebrow>
            <h1 className="text-[44px] font-bold leading-[1.05] tracking-tight md:text-[56px]">Your brand. Your store.<br />Live today.</h1>
            <p className="max-w-xl text-lg text-muted">Create a complete online store with IND2B templates and plugins. Accept UPI, cards and cash on delivery, send GST invoices and ship across India, all from one dashboard.</p>
            <form action="/signup" className="flex max-w-lg flex-col gap-2.5 sm:flex-row">
              <label htmlFor="hero-name" className="sr-only">Your store name</label>
              <div className="flex h-12 flex-1 items-center rounded-control border-[1.5px] border-teal-700 bg-surface pr-3">
                <input id="hero-name" name="store" placeholder="Your store name" className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[15px] outline-none" />
                <span className="font-mono text-[13px] text-muted">.ind2b.com</span>
              </div>
              <button className="h-12 rounded-control bg-teal-700 px-6 font-semibold text-white hover:bg-teal-800">Start free</button>
            </form>
            <p className="text-[13px] text-muted">Free to start · No card needed · Cancel any time</p>
          </div>
          <div className="relative">
            <TemplateThumb template={templates.find((t) => t.id === "vastra")!} scale={0.46} height={440} />
            <div className="absolute -bottom-5 -left-5 hidden w-60 rounded-card border border-line bg-surface p-4 shadow-lg md:block">
              <div className="text-xs text-muted">New order · #1042</div>
              <div className="mt-1 font-semibold">Chanderi Silk Saree</div>
              <div className="mt-2 flex items-center justify-between"><span className="font-mono">₹4,890</span><StatusPill tone="ok">Paid · UPI</StatusPill></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1280px] flex-col gap-8 px-6 py-16">
        <h2 className="text-3xl">Three steps to your first sale</h2>
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t}><Card className="flex h-full flex-col gap-3 p-6"><span className="flex size-9 items-center justify-center rounded-full bg-teal-50 font-display font-bold text-teal-700">{i + 1}</span><h3 className="text-lg">{t}</h3><p className="text-sm text-muted">{d}</p></Card></li>
          ))}
        </ol>
      </section>

      <section className="bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl">Templates for every kind of business</h2><p className="mt-2 text-muted">Fashion, electronics, grocery, handmade, wholesale — start from a design that fits.</p></div><ButtonLink href="/templates" variant="secondary">See all templates</ButtonLink></div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {templates.slice(0, 3).map((t) => (
              <Link key={t.id} href={`/templates/${t.id}`} className="group flex flex-col gap-3">
                <TemplateThumb template={t} />
                <div className="flex items-center justify-between"><span className="font-display text-lg font-semibold group-hover:text-teal-700">{t.name}</span>{t.free ? <StatusPill tone="ok" dot={false}>Free</StatusPill> : <StatusPill tone="teal" dot={false}>Premium</StatusPill>}</div>
                <span className="text-sm text-muted">{t.tagline}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1280px] flex-col gap-8 px-6 py-16">
        <h2 className="text-3xl">Everything a shop needs</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([icon, t, d]) => <Card key={t} className="flex flex-col gap-3 p-5"><Icon name={icon} size={22} className="text-teal-700" /><h3 className="text-base">{t}</h3><p className="text-sm text-muted">{d}</p></Card>)}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>Popular plugins:</span>
          {apps.slice(0, 6).map((a) => <Link key={a.id} href={`/plugins#${a.id}`} className="rounded-full border border-line bg-surface px-3 py-1 text-ink-2 hover:border-teal-700">{a.name}</Link>)}
        </div>
      </section>

      <section className="bg-teal-700 text-white">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-6 px-6 py-14 md:flex-row md:items-center">
          <div><h2 className="text-3xl text-white">Start free. Upgrade when you grow.</h2><p className="mt-2 text-[#d7ebe8]">Plans from {formatINR(plans[0]!.pricePaise ?? 0)}/month + {plans[0]!.transactionFeePct}% per order. No setup fee.</p></div>
          <div className="flex gap-3"><Link href="/pricing" className="inline-flex h-12 items-center rounded-control border border-white/40 px-6 font-semibold">See pricing</Link><Link href="/signup" className="inline-flex h-12 items-center rounded-control bg-white px-6 font-semibold text-teal-800">Create your store</Link></div>
        </div>
      </section>
    </>
  );
}
