import "server-only";
import { getStoreBySlug, listCollections, listProducts, type Template } from "@/lib/services";
import type { SectionContext } from "@/components/sections";

/** Sample catalogue used to preview templates before a merchant has products. */
export async function demoContext(template: Template): Promise<SectionContext> {
  const sample = await getStoreBySlug(template.id === "udyog" ? "shreejisteel" : "priyahandlooms");
  const products = sample ? await listProducts(sample.id, { activeOnly: true }) : [];
  const collections = sample ? await listCollections(sample.id) : [];
  return {
    store: { id: "demo", name: "Your Store", slug: "yourstore", installedApps: ["razorpay", "cod", "b2b-wholesale", "whatsapp-chat", "product-reviews"],
      settings: sample?.settings ?? { email: "hello@yourstore.in", phone: "", address: "", state: "Maharashtra", currency: "INR", pricesIncludeGst: true, shipping: { flatRatePaise: 0, freeAbovePaise: null }, payments: { razorpay: true, cod: true, upi: true } } },
    products, collections, base: "", preview: true, cartCount: 0,
  };
}
