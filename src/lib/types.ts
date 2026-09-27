/**
 * IND2B commerce platform — shared API types.
 * Shapes the app works with (documents from MongoDB are mapped to these). Money is integer paise.
 */

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "teal";

/* ------------------------------------------------------------------ Sessions */
export type Role = "merchant" | "admin";
export type User = { id: string; email: string; name: string; phone: string; role: Role; createdAt: string };
export type Session = { userId: string; name: string; email: string; role: Role };

/* ------------------------------------------------------------------ Stores (tenants) */
export type StoreCategory = "fashion" | "electronics" | "grocery" | "beauty" | "home" | "food" | "b2b" | "other";
export type PlanId = "starter" | "grow" | "pro";

export type Store = {
  id: string;
  slug: string;                 // subdomain: slug.ind2b.com
  name: string;                 // the store owner's own brand name
  ownerId: string;
  category: StoreCategory;
  plan: PlanId;
  status: "active" | "setup" | "suspended";
  templateId: string;
  theme: Theme;                 // published theme
  draftTheme?: Theme;           // page-builder draft
  customDomain?: { host: string; status: "pending" | "verified" };
  installedApps: string[];      // app ids
  settings: StoreSettings;
  kyc: "not_started" | "pending" | "verified" | "rejected";
  kycNote?: string;             // reason shown to the merchant when KYC is rejected
  kycDocs?: KycDoc[];
  logo?: ImageRef;
  createdAt: string;
};

export type StoreSettings = {
  email: string; phone: string; address: string; state: string; gstin?: string;
  currency: "INR";
  pricesIncludeGst: boolean;
  shipping: { flatRatePaise: number; freeAbovePaise: number | null };
  payments: { razorpay: boolean; cod: boolean; upi: boolean };
};

/* ------------------------------------------------------------------ Catalog */
export type Variant = { id: string; title: string; sku: string; pricePaise: number; compareAtPaise?: number; stock: number };
/** An uploaded image (see src/lib/media). `url` is always one this platform issued. */
export type ImageRef = { id: string; url: string; alt?: string; width?: number; height?: number };
export type KycDoc = { fileId: string; kind: "pan" | "bank" | "gst"; filename: string; contentType: string; size: number; uploadedAt: string };
export type MediaItem = ImageRef & { storeId: string; purpose: "product" | "logo" | "section"; bytes: number; provider: "cloudinary" | "local"; createdAt: string };

export type Product = {
  id: string; storeId: string; handle: string; title: string; description: string;
  status: "active" | "draft"; collection: string; tags: string[]; images: ImageRef[];
  variants: Variant[]; gstRate: number; hsn?: string;
  /** B2B plugin: volume price tiers (applied when the "b2b-wholesale" app is installed). */
  tiers?: { minQty: number; pricePaise: number }[];
  createdAt: string;
};
export type Collection = { handle: string; title: string };

/* ------------------------------------------------------------------ Orders & customers */
export type OrderStatus = "unfulfilled" | "fulfilled" | "delivered" | "cancelled" | "returned";
export type PaymentStatus = "paid" | "pending" | "cod" | "refunded";
export type OrderLine = { productId: string; variantId: string; title: string; variantTitle: string; qty: number; unitPricePaise: number; imageUrl?: string };
export type Order = {
  id: string; number: number; storeId: string; createdAt: string;
  customer: { name: string; email: string; phone: string; address: string; city: string; pincode: string; state: string };
  lines: OrderLine[]; subtotalPaise: number; shippingPaise: number; discountPaise: number; taxPaise: number; totalPaise: number;
  payment: { method: "upi" | "card" | "netbanking" | "cod"; status: PaymentStatus };
  status: OrderStatus; discountCode?: string;
  checkoutToken?: string;       // one per checkout page load: a double-submitted form cannot create two orders
};
export type Customer = { email: string; name: string; phone: string; city: string; orders: number; spentPaise: number };
export type Discount = { code: string; type: "percent" | "fixed"; value: number; minSubtotalPaise: number; active: boolean; uses: number };

/* ------------------------------------------------------------------ Themes, templates, sections */
export type SectionType =
  | "announcement" | "header" | "hero" | "featured-products" | "collection-list" | "image-with-text"
  | "rich-text" | "testimonials" | "newsletter" | "footer"
  // provided by apps (plugins):
  | "rfq-form" | "reviews" | "whatsapp-button";
export type Section = { id: string; type: SectionType; hidden?: boolean; settings: Record<string, string | number | boolean> };
export type ThemeTokens = { primary: string; accent: string; background: string; text: string; onPrimary: string; onAccent: string; radius: number; font: "sans" | "serif" | "display" };
export type Theme = { templateId: string; version: number; tokens: ThemeTokens; sections: Section[] };

export type Template = {
  id: string; name: string; tagline: string; bestFor: StoreCategory[]; free: boolean;
  tokens: ThemeTokens; sections: Section[];
};

/* ------------------------------------------------------------------ Apps (plugins) */
export type AppCategory = "sales" | "payments" | "shipping" | "marketing" | "b2b" | "compliance" | "support";
export type ExtensionPoint = "storefront-section" | "storefront-embed" | "checkout-payment" | "order-webhook" | "product-pricing" | "admin-page";
export type AppDef = {
  id: string; name: string; developer: string; category: AppCategory; summary: string; description: string;
  pricing: string; rating: number; installs: number; builtIn: boolean;
  extensions: ExtensionPoint[];
  /** Section types this app adds to the page builder. */
  sections?: SectionType[];
  status: "published" | "in_review" | "rejected";
};

/* ------------------------------------------------------------------ Platform */
export type Plan = { id: PlanId; name: string; pricePaise: number | null; transactionFeePct: number; features: string[] };
export type ServiceHealth = { name: string; status: { label: string; tone: Tone }; metric: string };

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  unfulfilled: { label: "Unfulfilled", tone: "warn" },
  fulfilled: { label: "Fulfilled", tone: "info" },
  delivered: { label: "Delivered", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  returned: { label: "Returned", tone: "bad" },
};
export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "ok" }, pending: { label: "Payment pending", tone: "warn" },
  cod: { label: "Cash on delivery", tone: "info" }, refunded: { label: "Refunded", tone: "neutral" },
};

/* ------------------------------------------------------------------ Leads */
export type QuoteRequest = { id: string; storeId: string; product: string; quantity: string; gstin?: string; phone: string; status: "new" | "contacted" | "won" | "lost"; createdAt: string };
export type Subscriber = { email: string; createdAt: string };
