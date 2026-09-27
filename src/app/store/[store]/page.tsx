import { StorefrontRenderer } from "@/components/sections";
import { resolveStore, sectionContext } from "@/lib/storefront";

const NOTICES: Record<string, { text: string; ok: boolean }> = {
  "rfq:sent": { text: "Thank you! Your quote request was sent. We will contact you soon.", ok: true },
  "rfq:invalid": { text: "Please fill in the product, quantity and a valid 10-digit mobile number.", ok: false },
  "rfq:limit": { text: "Too many requests from your network. Please try again later.", ok: false },
  "subscribed:1": { text: "You're subscribed. Thank you!", ok: true },
  "subscribed:0": { text: "Please enter a valid email address.", ok: false },
};

export default async function StoreHome({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ rfq?: string; subscribed?: string }> }) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams]);
  const { store, base } = await resolveStore(slug);
  const ctx = await sectionContext(store, base);
  const notice = sp.rfq ? NOTICES[`rfq:${sp.rfq}`] : sp.subscribed ? NOTICES[`subscribed:${sp.subscribed}`] : undefined;
  return (
    <>
      {notice && <p role="status" className={`px-5 py-3 text-center text-sm font-medium ${notice.ok ? "bg-ok-50 text-ok" : "bg-bad-50 text-bad"}`}>{notice.text}</p>}
      <StorefrontRenderer theme={store.theme} ctx={ctx}
        only={["hero", "featured-products", "collection-list", "image-with-text", "rich-text", "testimonials", "newsletter", "rfq-form", "reviews", "whatsapp-button"]} />
    </>
  );
}
