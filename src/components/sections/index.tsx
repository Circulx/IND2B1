import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { Collection, Product, Section, SectionType, Store, Theme, ThemeTokens } from "@/lib/types";
import { Icon, Img, formatINR } from "@/components/ui";

/**
 * Storefront sections — the building blocks of every template.
 * The SAME components render the live store (apps/storefront) and the page
 * builder preview (apps/dashboard), so merchants see exactly what shoppers see.
 *
 * Responsive rules use CONTAINER queries (@3xl: etc.), not viewport breakpoints,
 * so the page-builder phone preview lays out exactly like a real phone.
 * Every renderer wraps sections in an element with the `@container` class.
 *
 * Rules for section authors (including app developers):
 *   • no hooks, no data fetching — everything arrives via props
 *   • colours, radius and fonts only from the --store-* CSS variables
 *   • every link is built from ctx.base so stores work on subdomains and custom domains
 */

export type SectionContext = {
  store: Pick<Store, "id" | "name" | "slug" | "settings" | "installedApps" | "logo">;
  products: Product[];
  collections: Collection[];
  /** Prefix for links: "" on name.ind2b.com or a custom domain, "/name" on the local dev host. */
  base: string;
  /** Page-builder preview: forms and links are inert. */
  preview?: boolean;
  /** Current cart size for the header badge. */
  cartCount?: number;
};

type Props = { settings: Section["settings"]; ctx: SectionContext };
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" ? v : Number(v) || d);

const primaryBtn: CSSProperties = { background: "var(--store-primary)", color: "var(--store-on-primary)", borderRadius: "var(--store-radius)" };
const accentBtn: CSSProperties = { background: "var(--store-accent)", color: "var(--store-on-accent)", borderRadius: "var(--store-radius)" };
const heading: CSSProperties = { fontFamily: "var(--store-font)", color: "var(--store-text)" };
const href = (ctx: SectionContext, path: string) => (ctx.preview ? undefined : `${ctx.base}${path}`);

/** Link that becomes a plain <span> in previews (previews are often wrapped in a link themselves; <a> inside <a> is invalid HTML). */
function A({ ctx, href: to, ...rest }: { ctx: SectionContext } & ComponentProps<"a">) {
  if (ctx.preview) { const { target: _t, rel: _r, ...span } = rest; return <span {...(span as ComponentProps<"span">)} />; }
  return <a href={to} {...rest} />;
}

/* ------------------------------------------------------------------ product card (also used by collection pages) */
export function ProductCard({ product, ctx }: { product: Product; ctx: SectionContext }) {
  const v = product.variants[0];
  if (!v) return null;
  const off = v.compareAtPaise && v.compareAtPaise > v.pricePaise ? Math.round(((v.compareAtPaise - v.pricePaise) / v.compareAtPaise) * 100) : 0;
  const soldOut = product.variants.every((x) => x.stock <= 0);
  return (
    <A ctx={ctx} href={href(ctx, `/products/${product.handle}`)} className="group flex flex-col gap-2.5">
      <div className="relative overflow-hidden" style={{ borderRadius: "var(--store-radius)" }}>
        <Img src={product.images[0]?.url} alt={product.images[0]?.alt || product.title} label={product.title} className="aspect-[4/5] w-full rounded-none text-center normal-case tracking-normal transition-transform group-hover:scale-[1.02]" />
        {off > 0 && <span className="absolute left-2 top-2 px-2 py-0.5 text-xs font-semibold" style={accentBtn}>{off}% off</span>}
        {soldOut && <span className="absolute right-2 top-2 bg-white/90 px-2 py-0.5 text-xs font-semibold text-ink">Sold out</span>}
      </div>
      <div className="text-[15px] leading-snug" style={{ color: "var(--store-text)" }}>{product.title}</div>
      <div className="flex items-baseline gap-2 text-sm">
        <span className="font-semibold" style={{ color: "var(--store-text)" }}>{formatINR(v.pricePaise)}</span>
        {off > 0 && <span className="text-muted line-through">{formatINR(v.compareAtPaise!)}</span>}
      </div>
    </A>
  );
}

/* ------------------------------------------------------------------ sections */
function Announcement({ settings }: Props) {
  return <div className="px-4 py-2 text-center text-[13px]" style={{ background: "var(--store-primary)", color: "var(--store-on-primary)" }}>{str(settings.text)}</div>;
}

function Header({ settings, ctx }: Props) {
  const menu = str(settings.menu, "Shop|About|Contact").split("|").filter(Boolean);
  return (
    <header className="flex h-[72px] items-center gap-8 border-b px-5 @3xl:px-10" style={{ borderColor: "color-mix(in srgb, var(--store-text) 12%, transparent)", background: "var(--store-bg)" }}>
      <A ctx={ctx} href={href(ctx, "/") ?? undefined} className="flex items-center gap-3 text-xl font-bold tracking-tight" style={heading}>
        {ctx.store.logo?.url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={ctx.store.logo.url} alt={ctx.store.name} className="h-10 w-auto max-w-[180px] object-contain" />
          : ctx.store.name}
      </A>
      <nav className="hidden gap-6 text-sm @3xl:flex" aria-label="Store">
        {menu.map((m, i) => <A ctx={ctx} key={m} href={href(ctx, i === 0 ? "/collections/all" : `/#${m.toLowerCase()}`)} style={{ color: "var(--store-text)" }}>{m}</A>)}
      </nav>
      <div className="flex-1" />
      <A ctx={ctx} href={href(ctx, "/collections/all")} aria-label="Search" style={{ color: "var(--store-text)" }}><Icon name="search" size={20} /></A>
      <A ctx={ctx} href={href(ctx, "/cart")} aria-label={`Cart, ${ctx.cartCount ?? 0} items`} className="relative" style={{ color: "var(--store-text)" }}>
        <Icon name="cart" size={22} />
        {!!ctx.cartCount && <span className="absolute -right-2 -top-2 flex size-[18px] items-center justify-center rounded-full text-[10px] font-semibold" style={accentBtn}>{ctx.cartCount}</span>}
      </A>
    </header>
  );
}

function Hero({ settings, ctx }: Props) {
  const layout = str(settings.layout, "split");
  const text = (
    <div className={`flex flex-col gap-5 ${layout === "centered" ? "items-center text-center" : ""}`}>
      <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] @3xl:text-[52px]" style={{ ...heading, color: layout === "full" ? "#fff" : "var(--store-text)" }}>{str(settings.heading)}</h1>
      <p className="max-w-xl text-[17px]" style={{ color: layout === "full" ? "rgba(255,255,255,.85)" : "color-mix(in srgb, var(--store-text) 70%, transparent)" }}>{str(settings.subheading)}</p>
      <A ctx={ctx} href={href(ctx, ctx.store.installedApps.includes("b2b-wholesale") && /quote/i.test(str(settings.cta)) ? "/#rfq" : "/collections/all")} className="inline-flex h-12 items-center self-start px-7 font-semibold" style={{ ...primaryBtn, alignSelf: layout === "centered" ? "center" : "flex-start" }}>{str(settings.cta, "Shop now")}</A>
    </div>
  );
  if (layout === "full") {
    return (
      <section className="relative isolate flex min-h-[460px] items-end overflow-hidden px-5 py-14 @3xl:px-10" style={{ background: "var(--store-primary)" }}>
        {str(settings.imageUrl)
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={str(settings.imageUrl)} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
          : <span className="absolute right-6 top-6 font-mono text-[11px] uppercase tracking-wider text-white/60">{str(settings.image, "Image")}</span>}
        <span className="absolute inset-0 -z-10" style={{ background: "linear-gradient(0deg, rgba(0,0,0,.6), rgba(0,0,0,.1))" }} aria-hidden="true" />
        {text}
      </section>
    );
  }
  if (layout === "centered") return <section className="px-5 py-20 @3xl:px-10" style={{ background: "color-mix(in srgb, var(--store-primary) 8%, var(--store-bg))" }}>{text}</section>;
  return (
    <section className="grid items-center gap-8 px-5 py-12 @3xl:grid-cols-2 @3xl:px-10 @3xl:py-16">
      {text}
      <Img src={str(settings.imageUrl) || undefined} alt={str(settings.heading)} label={str(settings.image, "Hero image")} className="aspect-[4/3] w-full" eager />
    </section>
  );
}

function FeaturedProducts({ settings, ctx }: Props) {
  const items = ctx.products.slice(0, num(settings.count, 8));
  return (
    <section className="flex flex-col gap-6 px-5 py-12 @3xl:px-10" id="shop">
      <div className="flex items-baseline justify-between"><h2 className="text-[28px] font-semibold" style={heading}>{str(settings.heading, "Featured")}</h2><A ctx={ctx} href={href(ctx, "/collections/all")} className="text-sm font-semibold" style={{ color: "var(--store-primary)" }}>View all</A></div>
      {items.length === 0 ? <p className="text-muted">Products you add in the dashboard appear here.</p> : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 @3xl:grid-cols-4">{items.map((p) => <ProductCard key={p.id} product={p} ctx={ctx} />)}</div>
      )}
    </section>
  );
}

function CollectionList({ settings, ctx }: Props) {
  return (
    <section className="flex flex-col gap-6 px-5 py-12 @3xl:px-10">
      <h2 className="text-[28px] font-semibold" style={heading}>{str(settings.heading, "Shop by collection")}</h2>
      <div className="grid grid-cols-2 gap-5 @3xl:grid-cols-4">
        {(ctx.collections.length ? ctx.collections : [{ handle: "all", title: "All products" }]).map((c) => (
          <A ctx={ctx} key={c.handle} href={href(ctx, `/collections/${c.handle}`)} className="flex flex-col gap-2.5">
            <Img src={ctx.products.find((p) => p.collection === c.handle && p.images[0])?.images[0]?.url} alt={c.title} label={c.title} className="aspect-square w-full" />
            <span className="font-semibold" style={{ color: "var(--store-text)" }}>{c.title} →</span>
          </A>
        ))}
      </div>
    </section>
  );
}

function ImageWithText({ settings }: Props) {
  const left = str(settings.imageSide, "left") === "left";
  return (
    <section className="grid items-center gap-10 px-5 py-12 @3xl:grid-cols-2 @3xl:px-10" id="about">
      <Img src={str(settings.imageUrl) || undefined} alt={str(settings.heading)} label="Image" className={`aspect-[4/3] w-full ${left ? "" : "@3xl:order-2"}`} />
      <div className="flex flex-col gap-4"><h2 className="text-[28px] font-semibold" style={heading}>{str(settings.heading)}</h2><p className="text-[16px] leading-relaxed" style={{ color: "color-mix(in srgb, var(--store-text) 75%, transparent)" }}>{str(settings.body)}</p></div>
    </section>
  );
}

function RichText({ settings }: Props) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-5 py-14 text-center">
      <h2 className="text-[28px] font-semibold" style={heading}>{str(settings.heading)}</h2>
      <p className="text-[16px] leading-relaxed" style={{ color: "color-mix(in srgb, var(--store-text) 75%, transparent)" }}>{str(settings.body)}</p>
    </section>
  );
}

function Testimonials({ settings }: Props) {
  const items = str(settings.items).split(";").filter(Boolean).map((x) => x.split("|"));
  return (
    <section className="flex flex-col gap-6 px-5 py-12 @3xl:px-10" style={{ background: "color-mix(in srgb, var(--store-primary) 6%, var(--store-bg))" }}>
      <h2 className="text-[28px] font-semibold" style={heading}>{str(settings.heading, "What customers say")}</h2>
      <div className="grid gap-5 @3xl:grid-cols-3">
        {items.map(([q, who]) => (
          <figure key={q} className="flex flex-col gap-3 bg-white p-6" style={{ borderRadius: "var(--store-radius)" }}>
            <div className="flex gap-0.5" style={{ color: "var(--store-accent)" }} aria-label="5 out of 5">{[0, 1, 2, 3, 4].map((i) => <Icon key={i} name="star" size={15} fill="currentColor" />)}</div>
            <blockquote className="text-[15px]">“{q}”</blockquote>
            <figcaption className="text-sm text-muted">{who}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Newsletter({ settings, ctx }: Props) {
  return (
    <section className="flex flex-col items-center gap-4 px-5 py-14 text-center" style={{ background: "var(--store-primary)", color: "var(--store-on-primary)" }}>
      <h2 className="text-[28px] font-semibold" style={{ fontFamily: "var(--store-font)", color: "var(--store-on-primary)" }}>{str(settings.heading)}</h2>
      <p className="opacity-85">{str(settings.body)}</p>
      <form className="flex w-full max-w-md gap-2" action={ctx.preview ? undefined : `${ctx.base}/api/subscribe`} method="post">
        <label htmlFor="nl-email" className="sr-only">Email</label>
        <input id="nl-email" name="email" type="email" required placeholder="you@example.com" className="h-12 flex-1 bg-white px-4 text-ink" style={{ borderRadius: "var(--store-radius)" }} />
        <button disabled={ctx.preview} className="h-12 px-5 font-semibold" style={accentBtn}>Subscribe</button>
      </form>
    </section>
  );
}

function Footer({ settings, ctx }: Props) {
  return (
    <footer className="flex flex-col gap-6 px-5 py-10 text-sm @3xl:px-10" style={{ background: "color-mix(in srgb, var(--store-text) 94%, #000)", color: "rgba(255,255,255,.8)" }} id="contact">
      <div className="grid gap-6 @3xl:grid-cols-3">
        <div className="flex flex-col gap-2"><b className="text-base text-white">{ctx.store.name}</b><span>{str(settings.text)}</span></div>
        <div className="flex flex-col gap-2"><b className="text-white">Help</b><span>Shipping &amp; delivery</span><span>Returns &amp; refunds</span><span>Privacy policy</span></div>
        <div className="flex flex-col gap-2"><b className="text-white">Contact</b><span>{ctx.store.settings.email}</span><span>{ctx.store.settings.phone}</span>{ctx.store.settings.gstin && <span>GSTIN {ctx.store.settings.gstin}</span>}</div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-white/15 pt-4 text-xs text-white/60">
        <span>© {ctx.store.name}</span>
        <A ctx={ctx} href="https://ind2b.com" className="text-white/60">Powered by <b className="text-white">IND2B</b></A>
      </div>
    </footer>
  );
}

/* ---------------- app-provided sections (only render when the app is installed) */
function RfqForm({ settings, ctx }: Props) {
  return (
    <section id="rfq" className="mx-5 mb-12 grid overflow-hidden border @3xl:mx-10 @3xl:grid-cols-[1fr_1.3fr]" style={{ borderRadius: "var(--store-radius)", borderColor: "color-mix(in srgb, var(--store-text) 12%, transparent)" }}>
      <div className="flex flex-col gap-3 p-8" style={{ background: "color-mix(in srgb, var(--store-primary) 7%, var(--store-bg))" }}>
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Request a quote · B2B</div>
        <h2 className="text-[26px] font-semibold" style={heading}>{str(settings.heading)}</h2>
        <p className="text-muted">{str(settings.body)}</p>
      </div>
      <form className="grid gap-4 bg-white p-8 @2xl:grid-cols-2" action={ctx.preview ? undefined : `${ctx.base}/api/rfq`} method="post">
        {[["rfq-product", "product", "Product & size", "text"], ["rfq-qty", "quantity", "Quantity", "text"], ["rfq-gstin", "gstin", "GSTIN (optional)", "text"], ["rfq-phone", "phone", "Mobile (WhatsApp)", "tel"]].map(([id, name, label, type]) => (
          <div key={id} className="flex flex-col gap-1.5"><label htmlFor={id} className="text-[13px] font-medium">{label}</label><input id={id} name={name} type={type} required={name !== "gstin"} className="h-11 rounded-control border border-control px-3" /></div>
        ))}
        <div className="flex justify-end @2xl:col-span-2"><button disabled={ctx.preview} className="h-11 px-7 font-semibold" style={accentBtn}>Send request</button></div>
      </form>
    </section>
  );
}

function Reviews({ settings }: Props) {
  return (
    <section className="flex flex-col gap-4 px-5 py-12 @3xl:px-10">
      <h2 className="text-[28px] font-semibold" style={heading}>{str(settings.heading, "Customer reviews")}</h2>
      <p className="flex items-center gap-2 text-sm"><span className="flex" style={{ color: "var(--store-accent)" }}>{[0, 1, 2, 3, 4].map((i) => <Icon key={i} name="star" size={16} fill="currentColor" />)}</span> 4.8 average from verified buyers</p>
    </section>
  );
}

function WhatsAppButton({ settings, ctx }: Props) {
  const phone = str(settings.phone, ctx.store.settings.phone).replace(/\D/g, "");
  return (
    <A ctx={ctx} href={ctx.preview || !phone ? undefined : `https://wa.me/${phone}`} aria-label="Chat on WhatsApp" className="fixed bottom-6 right-6 z-20 flex size-14 items-center justify-center rounded-full bg-[#1a7f4b] text-white shadow-lg">
      <Icon name="whatsapp" size={26} />
    </A>
  );
}

export const SECTION_COMPONENTS: Record<SectionType, (p: Props) => ReactNode> = {
  announcement: Announcement, header: Header, hero: Hero, "featured-products": FeaturedProducts, "collection-list": CollectionList,
  "image-with-text": ImageWithText, "rich-text": RichText, testimonials: Testimonials, newsletter: Newsletter, footer: Footer,
  "rfq-form": RfqForm, reviews: Reviews, "whatsapp-button": WhatsAppButton,
};

export const SECTION_LABELS: Record<SectionType, string> = {
  announcement: "Announcement bar", header: "Header", hero: "Hero banner", "featured-products": "Featured products", "collection-list": "Collection list",
  "image-with-text": "Image with text", "rich-text": "Rich text", testimonials: "Testimonials", newsletter: "Newsletter", footer: "Footer",
  "rfq-form": "Quote request form", reviews: "Product reviews", "whatsapp-button": "WhatsApp button",
};

/** Which app must be installed for an app-provided section to render. */
export const SECTION_REQUIRES_APP: Partial<Record<SectionType, string>> = {
  "rfq-form": "b2b-wholesale", reviews: "product-reviews", "whatsapp-button": "whatsapp-chat",
};

/** Default settings when a merchant adds a new section in the builder. */
export const SECTION_DEFAULTS: Record<SectionType, Section["settings"]> = {
  announcement: { text: "Free shipping on orders above ₹999" }, header: { menu: "Shop|About|Contact" },
  hero: { layout: "split", heading: "Your headline here", subheading: "Say what makes your products special.", cta: "Shop now", image: "Hero image" },
  "featured-products": { heading: "Featured products", count: 8, collection: "all" }, "collection-list": { heading: "Shop by collection" },
  "image-with-text": { heading: "Our story", body: "Tell customers about your brand.", imageSide: "left" }, "rich-text": { heading: "Why shop with us", body: "Add a short message." },
  testimonials: { heading: "What customers say", items: "Great quality!|A happy customer" }, newsletter: { heading: "Stay in touch", body: "New launches and offers, once a month." },
  footer: { text: "Thank you for shopping with us" }, "rfq-form": { heading: "Request a quote", body: "Tell us what you need and we will reply with a price." },
  reviews: { heading: "Customer reviews" }, "whatsapp-button": { phone: "" },
};

const FONTS: Record<ThemeTokens["font"], string> = {
  sans: '"IBM Plex Sans", "Noto Sans Devanagari", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", "Noto Serif Devanagari", serif',
  display: '"Archivo", "Helvetica Neue", Arial, sans-serif',
};

/** Theme tokens → CSS variables on the storefront root. */
export function themeStyle(tokens: ThemeTokens): CSSProperties {
  return {
    ["--store-primary" as string]: tokens.primary, ["--store-accent" as string]: tokens.accent,
    ["--store-on-primary" as string]: tokens.onPrimary, ["--store-on-accent" as string]: tokens.onAccent,
    ["--store-bg" as string]: tokens.background, ["--store-text" as string]: tokens.text,
    ["--store-radius" as string]: `${tokens.radius}px`, ["--store-font" as string]: FONTS[tokens.font],
    background: tokens.background, color: tokens.text,
  };
}

/** Sections visible to shoppers: not hidden, and their app (if any) is installed. */
export function visibleSections(theme: Theme, installedApps: string[]) {
  return theme.sections.filter((s) => !s.hidden && (!SECTION_REQUIRES_APP[s.type] || installedApps.includes(SECTION_REQUIRES_APP[s.type]!)));
}

export function SectionView({ section, ctx }: { section: Section; ctx: SectionContext }) {
  const Cmp = SECTION_COMPONENTS[section.type];
  return <Cmp settings={section.settings} ctx={ctx} />;
}

export function StorefrontRenderer({ theme, ctx, only }: { theme: Theme; ctx: SectionContext; only?: SectionType[] }) {
  const sections = visibleSections(theme, ctx.store.installedApps).filter((s) => !only || only.includes(s.type));
  return <>{sections.map((s) => <SectionView key={s.id} section={s} ctx={ctx} />)}</>;
}
