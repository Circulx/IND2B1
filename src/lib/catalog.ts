import type { AppDef, Plan, Section, Template, ThemeTokens } from "./types";

/* =====================================================================
 * Templates. Each template is a theme: design tokens + a default page of
 * sections. Store owners start from one and edit it in the page builder.
 * Add a template here and it appears in the gallery, the wizard and the dashboard.
 * ===================================================================== */

const s = (id: string, type: Section["type"], settings: Section["settings"]): Section => ({ id, type, settings });
const tokens = (t: Partial<ThemeTokens>): ThemeTokens => ({
  primary: "#0B5F5C", accent: "#E07B22", background: "#FFFFFF", text: "#16202A", onPrimary: "#FFFFFF", onAccent: "#16202A", radius: 8, font: "sans", ...t,
});

export const TEMPLATES: Template[] = [
  {
    id: "aarambh", name: "Aarambh", tagline: "Clean, fast starter for any kind of shop", bestFor: ["other", "home", "beauty"], free: true,
    tokens: tokens({ primary: "#16202A", accent: "#0B5F5C", onAccent: "#FFFFFF", radius: 6 }),
    sections: [
      s("a1", "announcement", { text: "Free shipping on orders above ₹999" }),
      s("a2", "header", { menu: "Shop|About|Contact" }),
      s("a3", "hero", { layout: "split", heading: "Everyday essentials, made well", subheading: "Thoughtfully designed products shipped across India in 3–5 days.", cta: "Shop now", image: "Hero image" }),
      s("a4", "featured-products", { heading: "Bestsellers", count: 8, collection: "all" }),
      s("a5", "image-with-text", { heading: "Our story", body: "Tell customers who you are, what you make and why it matters. Replace this text in the page builder.", imageSide: "left" }),
      s("a6", "newsletter", { heading: "Get 10% off your first order", body: "Join our list for new launches and offers." }),
      s("a7", "footer", { text: "Secure payments by UPI, cards and net-banking" }),
    ],
  },
  {
    id: "vastra", name: "Vastra", tagline: "Editorial look for fashion, handloom and jewellery", bestFor: ["fashion", "beauty"], free: true,
    tokens: tokens({ primary: "#7A1F3D", accent: "#C9A227", background: "#FBF8F4", onAccent: "#16202A", radius: 2, font: "serif" }),
    sections: [
      s("v1", "announcement", { text: "Handwoven in India · Cash on delivery available" }),
      s("v2", "header", { menu: "New in|Sarees|Kurtas|Stories" }),
      s("v3", "hero", { layout: "full", heading: "Woven by hand, worn with pride", subheading: "Pure cotton and silk sarees from weavers across India.", cta: "Explore the collection", image: "Lookbook image" }),
      s("v4", "collection-list", { heading: "Shop by collection" }),
      s("v5", "featured-products", { heading: "New arrivals", count: 8, collection: "all" }),
      s("v6", "testimonials", { heading: "Loved by customers", items: "The Chanderi saree is even more beautiful in person.|Meera, Bengaluru;Quick delivery and lovely packaging.|Ritika, Pune;Colours exactly as shown. Will order again.|Anjali, Delhi" }),
      s("v7", "newsletter", { heading: "Join the Vastra circle", body: "Early access to new weaves and festive edits." }),
      s("v8", "footer", { text: "Handcrafted with care" }),
    ],
  },
  {
    id: "circuit", name: "Circuit", tagline: "Spec-first layout for electronics and gadgets", bestFor: ["electronics"], free: true,
    tokens: tokens({ primary: "#1B2A4A", accent: "#2E7CF6", onAccent: "#FFFFFF", radius: 10, font: "display" }),
    sections: [
      s("c1", "announcement", { text: "1-year warranty on all products · GST invoice with every order" }),
      s("c2", "header", { menu: "Audio|Wearables|Accessories|Support" }),
      s("c3", "hero", { layout: "split", heading: "Sound that goes where you go", subheading: "Wireless audio tuned for Indian commutes. 30-hour battery, fast charging.", cta: "Shop audio", image: "Product hero" }),
      s("c4", "featured-products", { heading: "Top picks", count: 8, collection: "all" }),
      s("c5", "rich-text", { heading: "Why buy direct", body: "Genuine products, official warranty, easy 7-day replacement and GST invoice for business buyers." }),
      s("c6", "footer", { text: "Authorised brand store" }),
    ],
  },
  {
    id: "kirana", name: "Kirana", tagline: "Quick re-ordering for grocery and daily needs", bestFor: ["grocery", "food"], free: true,
    tokens: tokens({ primary: "#1F6B3A", accent: "#F2B632", onAccent: "#16202A", radius: 12 }),
    sections: [
      s("k1", "announcement", { text: "Same-day delivery in your city · Order before 4 PM" }),
      s("k2", "header", { menu: "Staples|Snacks|Dairy|Offers" }),
      s("k3", "hero", { layout: "centered", heading: "Fresh groceries at your door", subheading: "Staples, snacks and daily needs from your neighbourhood store.", cta: "Start shopping", image: "Groceries" }),
      s("k4", "collection-list", { heading: "Shop by category" }),
      s("k5", "featured-products", { heading: "Daily essentials", count: 12, collection: "all" }),
      s("k6", "footer", { text: "Freshness guaranteed" }),
    ],
  },
  {
    id: "udyog", name: "Udyog", tagline: "Wholesale and B2B catalogue with quote requests", bestFor: ["b2b"], free: false,
    tokens: tokens({ primary: "#1D3557", accent: "#E07B22", onAccent: "#16202A", radius: 4 }),
    sections: [
      s("u1", "announcement", { text: "GST invoice on every order · Bulk pricing for trade buyers" }),
      s("u2", "header", { menu: "Products|Industries|Certifications|Contact" }),
      s("u3", "hero", { layout: "split", heading: "ISI-marked steel pipes, straight from our mill", subheading: "15 NB to 150 NB in light, medium and heavy class. Mill test certificate with every dispatch.", cta: "Request a quote", image: "Mill photo" }),
      s("u4", "featured-products", { heading: "Our range", count: 6, collection: "all" }),
      s("u5", "rfq-form", { heading: "Tell us size, grade and quantity", body: "Our sales team replies within a few working hours with price, freight and dispatch date." }),
      s("u6", "footer", { text: "Manufacturer · Pan-India dispatch" }),
    ],
  },
];

/* =====================================================================
 * Apps (plugins). Built-in apps are maintained by IND2B; third-party apps
 * go through review in /admin/apps. Each app declares the extension points
 * it uses so the platform knows where it can run.
 * ===================================================================== */
export const APPS: AppDef[] = [
  { id: "razorpay", name: "Razorpay Payments", developer: "IND2B", category: "payments", summary: "UPI, cards, net-banking and wallets at checkout.", description: "Accept online payments with automatic settlement to your bank account. Required for online checkout.", pricing: "Free · gateway fees apply", rating: 4.7, installs: 18240, builtIn: true, extensions: ["checkout-payment", "order-webhook"], status: "published" },
  { id: "cod", name: "Cash on Delivery", developer: "IND2B", category: "payments", summary: "Let customers pay when the order arrives.", description: "Adds Cash on Delivery at checkout, with an optional order limit and OTP confirmation for COD orders.", pricing: "Free", rating: 4.5, installs: 15110, builtIn: true, extensions: ["checkout-payment"], status: "published" },
  { id: "gst-invoice", name: "GST Invoices", developer: "IND2B", category: "compliance", summary: "GST-compliant invoices and e-invoicing (IRN).", description: "Creates tax invoices with HSN, CGST/SGST or IGST, and registers e-invoices for eligible businesses.", pricing: "Free", rating: 4.6, installs: 12890, builtIn: true, extensions: ["order-webhook", "admin-page"], status: "published" },
  { id: "shiprocket", name: "Shiprocket Shipping", developer: "IND2B", category: "shipping", summary: "Live courier rates, labels and tracking.", description: "Compare courier rates, print labels, schedule pickups and send tracking updates to customers.", pricing: "Pay per shipment", rating: 4.4, installs: 9320, builtIn: true, extensions: ["order-webhook", "admin-page"], status: "published" },
  { id: "whatsapp-chat", name: "WhatsApp Chat & Alerts", developer: "IND2B", category: "support", summary: "Chat button on your store and order updates on WhatsApp.", description: "Adds a WhatsApp button to every page and sends order confirmation, shipping and delivery messages.", pricing: "Free up to 500 messages / month", rating: 4.8, installs: 14020, builtIn: true, extensions: ["storefront-embed", "order-webhook"], sections: ["whatsapp-button"], status: "published" },
  { id: "product-reviews", name: "Product Reviews", developer: "IND2B", category: "marketing", summary: "Collect and show verified customer reviews.", description: "Asks customers for a review after delivery and shows star ratings and reviews on your store.", pricing: "Free", rating: 4.5, installs: 7610, builtIn: true, extensions: ["storefront-section", "order-webhook"], sections: ["reviews"], status: "published" },
  { id: "b2b-wholesale", name: "B2B Wholesale", developer: "IND2B", category: "b2b", summary: "Quote requests, bulk-price tiers and trade accounts.", description: "Adds a request-for-quote form, volume price tiers on products and GST-registered trade buyer accounts.", pricing: "Included in Grow and Pro", rating: 4.6, installs: 2140, builtIn: true, extensions: ["storefront-section", "product-pricing", "admin-page"], sections: ["rfq-form"], status: "published" },
  { id: "abandoned-cart", name: "Abandoned Cart Recovery", developer: "IND2B", category: "marketing", summary: "Remind shoppers who left items in their cart.", description: "Sends a WhatsApp or email reminder with a link back to the cart, with an optional discount.", pricing: "Free", rating: 4.3, installs: 6050, builtIn: true, extensions: ["order-webhook"], status: "published" },
  { id: "seo-booster", name: "SEO Booster", developer: "Searchly Labs", category: "marketing", summary: "Meta tags, sitemaps and rich results checks.", description: "Audits every page, fixes missing meta tags and image alt text, and checks product rich results.", pricing: "₹199 / month", rating: 4.2, installs: 3310, builtIn: false, extensions: ["admin-page"], status: "published" },
  { id: "loyalty-points", name: "Loyalty Points", developer: "Rewardify", category: "sales", summary: "Reward repeat customers with points.", description: "Customers earn points on every order and redeem them at checkout.", pricing: "₹299 / month", rating: 4.1, installs: 1880, builtIn: false, extensions: ["checkout-payment", "storefront-embed"], status: "published" },
  { id: "instagram-shop", name: "Instagram & Facebook Shop", developer: "IND2B", category: "sales", summary: "Sync products to Instagram and Facebook.", description: "Keeps your catalogue in sync with Meta Commerce so posts and reels can be tagged with products.", pricing: "Free", rating: 4.0, installs: 5420, builtIn: true, extensions: ["admin-page"], status: "published" },
  { id: "gift-wrap", name: "Gift Wrap & Messages", developer: "Tohfa Apps", category: "sales", summary: "Paid gift wrapping and gift notes at checkout.", description: "Customers add gift wrap and a personal note to any order.", pricing: "₹99 / month", rating: 3.9, installs: 410, builtIn: false, extensions: ["checkout-payment"], status: "in_review" },
];

/* =====================================================================
 * Plans. Example prices: set your own before launch.
 * ===================================================================== */
export const PLANS: Plan[] = [
  { id: "starter", name: "Starter", pricePaise: 0, transactionFeePct: 2, features: ["Online store on yourname.ind2b.com", "All free templates", "Up to 100 products", "UPI, cards and COD", "2 staff accounts"] },
  { id: "grow", name: "Grow", pricePaise: 999_00, transactionFeePct: 1, features: ["Your own domain", "Unlimited products", "Discount codes & abandoned cart", "B2B Wholesale app", "5 staff accounts"] },
  { id: "pro", name: "Pro", pricePaise: 2_999_00, transactionFeePct: 0.5, features: ["Everything in Grow", "Premium templates", "Multiple stores", "Advanced reports", "Priority support"] },
];
