"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  PLANS, TEMPLATES, applyTemplate, createDiscount, isDomainTaken, deleteDiscount, deleteProduct, getApp, getProduct, installApp, setQuoteRequestStatus,
  toggleDiscount, uninstallApp, updateOrderStatus, updateStore, upsertProduct, type OrderStatus, type Product,
} from "@/lib/services";
import { deleteUnusedMedia, resolveImages } from "@/lib/media";
import { requireStore } from "@/lib/merchant";

/**
 * Every action re-checks the session and works only on the merchant's active
 * store (requireStore). Nothing trusts a storeId from the form.
 */

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;
const rupeesToPaise = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "").replace(/[,₹\s]/g, "")) * 100);

/* ------------------------------------------------------------------ orders */
const NEXT_STATUS: Record<string, OrderStatus[]> = {
  unfulfilled: ["fulfilled", "cancelled"], fulfilled: ["delivered", "returned"], delivered: ["returned"], cancelled: [], returned: [],
};

export async function setOrderStatus(orderId: string, current: OrderStatus, next: OrderStatus) {
  const { store } = await requireStore();
  if (!NEXT_STATUS[current]?.includes(next)) throw new Error("invalid_transition");
  try {
    await updateOrderStatus(store.id, orderId, current, next);
  } catch (e) {
    if (!(e instanceof Error && e.message === "status_changed")) throw e;   // someone else already changed it; just refresh
  }
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
}

/* ------------------------------------------------------------------ products */
const variantSchema = z.object({
  id: z.string().regex(/^v_[A-Za-z0-9_-]{1,40}$/).optional().catch(undefined),
  title: z.string().trim().min(1, "Variant name is required").max(60),
  sku: z.string().trim().max(40),
  price: z.number().int().positive("Enter a price above ₹0").max(10_000_000_00, "Price is too high"),
  compareAt: z.number().int().nonnegative().max(10_000_000_00).optional(),
  stock: z.number().int().min(0, "Stock cannot be negative").max(1_000_000, "Stock is too high"),
});
const productSchema = z.object({
  title: z.string().trim().min(2, "Enter a product title").max(120),
  description: z.string().trim().max(5000),
  status: z.enum(["active", "draft"]),
  collection: z.string().trim().min(1, "Enter a collection").max(40).transform((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),
  gstRate: z.coerce.number().refine((n) => [0, 5, 12, 18, 28].includes(n), "Choose a GST rate"),
  hsn: z.string().trim().regex(/^(\d{4}|\d{6}|\d{8})?$/, "HSN is 4, 6 or 8 digits").optional(),
});

export async function saveProduct(productId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const { store } = await requireStore();
  const parsed = productSchema.safeParse({
    title: fd.get("title"), description: fd.get("description") ?? "", status: fd.get("status"),
    collection: fd.get("collection"), gstRate: fd.get("gstRate"), hsn: fd.get("hsn") || undefined,
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };

  // Variants arrive as parallel arrays: v_title[], v_sku[], v_price[], ...
  const titles = fd.getAll("v_title").slice(0, 100);
  const variants = [];
  for (let i = 0; i < titles.length; i++) {
    const compare = rupeesToPaise(fd.getAll("v_compare")[i] ?? null);
    const v = variantSchema.safeParse({
      id: String(fd.getAll("v_id")[i] ?? "") || undefined, title: titles[i], sku: fd.getAll("v_sku")[i] ?? "",
      price: rupeesToPaise(fd.getAll("v_price")[i] ?? null), compareAt: compare > 0 ? compare : undefined,
      stock: Number(fd.getAll("v_stock")[i] ?? 0),
    });
    if (!v.success) return { error: `Variant ${i + 1}: ${v.error.issues[0]?.message}` };
    variants.push(v.data);
  }
  if (variants.length === 0) return { error: "Add at least one variant." };

  const existing = productId ? await getProduct(store.id, productId) : undefined;
  if (productId && !existing) return { error: "Product not found." };

  // B2B tiers only when the wholesale plugin is installed.
  let tiers: Product["tiers"];
  if (store.installedApps.includes("b2b-wholesale")) {
    const qs = fd.getAll("t_qty"), ps = fd.getAll("t_price");
    tiers = qs.map((q, i) => ({ minQty: Number(q), pricePaise: rupeesToPaise(ps[i] ?? null) }))
      .filter((t) => t.minQty > 1 && t.pricePaise > 0).sort((a, b) => a.minQty - b.minQty);
  } else tiers = existing?.tiers;

  // Images: only ids of this store's uploads are accepted; URLs come from the database.
  const images = await resolveImages(store.id, fd.getAll("img_id").map(String), fd.getAll("img_alt").map(String));

  const saved = await upsertProduct(store.id, {
    id: existing?.id, ...parsed.data, hsn: parsed.data.hsn || undefined, tags: existing?.tags ?? [], images, tiers,
    variants: variants.map((v, i) => ({
      id: v.id ?? `v_${Date.now().toString(36)}_${i}`, title: v.title, sku: v.sku || `SKU-${i + 1}`,
      pricePaise: v.price, compareAtPaise: v.compareAt, stock: v.stock,
    })),
  });
  // Delete image files this product no longer uses (unless used elsewhere in the store).
  const removed = (existing?.images ?? []).map((i) => i.id).filter((id) => !images.some((x) => x.id === id));
  if (removed.length) await deleteUnusedMedia(store.id, removed);
  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${saved.id}`);
  redirect(`/dashboard/products/${saved.id}?saved=1`);
}

export async function deleteProductAction(productId: string) {
  const { store } = await requireStore();
  const imageIds = await deleteProduct(store.id, productId);
  if (imageIds.length) await deleteUnusedMedia(store.id, imageIds);
  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?deleted=1");
}

export async function setProductStatus(productId: string, status: "active" | "draft") {
  const { store } = await requireStore();
  const p = await getProduct(store.id, productId);
  if (!p) throw new Error("not_found");
  const { id, storeId: _s, createdAt: _c, handle: _h, ...rest } = p;
  await upsertProduct(store.id, { ...rest, id, status });
  revalidatePath("/dashboard/products");
}

/* ------------------------------------------------------------------ discounts */
const discountSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, "3–20 letters or digits, no spaces"),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive("Enter a value"),
  min: z.coerce.number().min(0),
});
export async function createDiscountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { store } = await requireStore();
  const parsed = discountSchema.safeParse({ code: fd.get("code"), type: fd.get("type"), value: fd.get("value"), min: fd.get("min") || 0 });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { code, type, value, min } = parsed.data;
  if (type === "percent" && value > 90) return { error: "Percentage discounts can be at most 90%." };
  try {
    await createDiscount(store.id, { code, type, value: type === "percent" ? Math.round(value) : Math.round(value * 100), minSubtotalPaise: Math.round(min * 100), active: true });
  } catch (e) {
    if (e instanceof Error && e.message === "code_exists") return { error: `The code ${code} already exists.` };
    throw e;
  }
  revalidatePath("/dashboard/discounts");
  return { ok: true };
}
export async function deleteDiscountAction(code: string) {
  const { store } = await requireStore();
  await deleteDiscount(store.id, code);
  revalidatePath("/dashboard/discounts");
}
export async function toggleDiscountAction(code: string) {
  const { store } = await requireStore();
  await toggleDiscount(store.id, code);
  revalidatePath("/dashboard/discounts");
}

/* ------------------------------------------------------------------ plugins (apps) */
const PLAN_RANK = { starter: 0, grow: 1, pro: 2 } as const;
export async function installAppAction(appId: string) {
  const { store } = await requireStore();
  const app = await getApp(appId);
  if (!app || app.status !== "published") throw new Error("unknown_app");
  if (appId === "b2b-wholesale" && PLAN_RANK[store.plan] < PLAN_RANK.grow) redirect("/dashboard/apps?error=plan");
  await installApp(store.id, appId);
  revalidatePath("/dashboard/apps");
  revalidatePath("/dashboard/editor");
}
export async function uninstallAppAction(appId: string) {
  const { store } = await requireStore();
  if (appId === "razorpay" && !store.installedApps.includes("cod")) redirect("/dashboard/apps?error=payments");
  await uninstallApp(store.id, appId);
  revalidatePath("/dashboard/apps");
  revalidatePath("/dashboard/editor");
}

/* ------------------------------------------------------------------ online store */
export async function applyTemplateAction(templateId: string) {
  const { store } = await requireStore();
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (!t) throw new Error("unknown_template");
  if (!t.free && store.plan !== "pro") redirect("/dashboard/online-store?error=premium");
  await applyTemplate(store.id, templateId);
  redirect("/dashboard/editor?applied=1");
}

const domainSchema = z.string().trim().toLowerCase().regex(/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, "Enter a domain like www.yourbrand.in");
export async function connectDomain(_prev: FormState, fd: FormData): Promise<FormState> {
  const { store } = await requireStore();
  if (store.plan === "starter") return { error: "Custom domains need the Grow or Pro plan." };
  const parsed = domainSchema.safeParse(fd.get("host"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.endsWith(".ind2b.com") || parsed.data === "ind2b.com") return { error: "Use your own domain, not an ind2b.com address." };
  if (await isDomainTaken(parsed.data, store.id)) return { error: "This domain is already connected to another store." };
  // Saved as pending. A DNS check job (CNAME → stores.ind2b.com) plus TLS issuance marks it verified.
  await updateStore(store.id, { customDomain: { host: parsed.data, status: "pending" } });
  revalidatePath("/dashboard/online-store");
  return { ok: true };
}
export async function removeDomain() {
  const { store } = await requireStore();
  await updateStore(store.id, { customDomain: undefined });
  revalidatePath("/dashboard/online-store");
}

/* ------------------------------------------------------------------ settings */
const settingsSchema = z.object({
  name: z.string().trim().min(2, "Enter your store name").max(60),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a 10-digit Indian mobile number").or(z.literal("")),
  address: z.string().trim().max(300),
  state: z.string().trim().min(2),
  gstin: z.string().trim().toUpperCase().regex(/^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])?$/, "GSTIN format looks wrong"),
  pricesIncludeGst: z.boolean(),
  flatRate: z.coerce.number().min(0).max(100_000),
  freeAbove: z.coerce.number().min(0).max(10_000_000).optional(),
});
export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const { store } = await requireStore();
  const parsed = settingsSchema.safeParse({
    name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") ?? "", address: fd.get("address") ?? "", state: fd.get("state"),
    gstin: fd.get("gstin") ?? "", pricesIncludeGst: fd.get("pricesIncludeGst") === "on", flatRate: fd.get("flatRate") || 0,
    freeAbove: fd.get("freeAbove") ? fd.get("freeAbove") : undefined,
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const d = parsed.data;
  await updateStore(store.id, {
    name: d.name,
    settings: {
      email: d.email, phone: d.phone, address: d.address, state: d.state, gstin: d.gstin || undefined, pricesIncludeGst: d.pricesIncludeGst,
      shipping: { flatRatePaise: Math.round(d.flatRate * 100), freeAbovePaise: d.freeAbove !== undefined ? Math.round(d.freeAbove * 100) : null },
    },
  });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings?saved=1");
}

export async function changePlan(planId: string) {
  const { store } = await requireStore();
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error("unknown_plan");
  // Plan changes apply immediately here. Connect Razorpay Subscriptions to charge before switching.
  await updateStore(store.id, { plan: plan.id });
  if (plan.id === "starter" && store.customDomain) await updateStore(store.id, { customDomain: undefined });
  revalidatePath("/dashboard", "layout");
}

/** Sends KYC for review once all three documents are uploaded. The IND2B team reviews it in /admin/kyc. */
export async function submitKyc(): Promise<void> {
  const { store } = await requireStore();
  const kinds = new Set((store.kycDocs ?? []).map((d) => d.kind));
  if (!["pan", "bank", "gst"].every((k) => kinds.has(k as "pan"))) redirect("/dashboard/settings?kyc=missing#kyc");
  if (store.kyc === "not_started" || store.kyc === "rejected") await updateStore(store.id, { kyc: "pending", kycNote: "" });
  revalidatePath("/dashboard", "layout");
}

/* ------------------------------------------------------------------ logo */
export async function setLogo(mediaId: string | null) {
  const { store } = await requireStore();
  const previous = store.logo?.id;
  if (mediaId) {
    const [img] = await resolveImages(store.id, [mediaId]);
    if (!img) throw new Error("unknown_image");
    await updateStore(store.id, { logo: img });
  } else {
    await updateStore(store.id, { logo: undefined });
  }
  if (previous && previous !== mediaId) await deleteUnusedMedia(store.id, [previous]);
  revalidatePath("/dashboard", "layout");
}

/* ------------------------------------------------------------------ B2B quote requests */
export async function setQuoteStatus(id: string, status: "new" | "contacted" | "won" | "lost") {
  const { store } = await requireStore();
  if (!["new", "contacted", "won", "lost"].includes(status)) throw new Error("invalid_status");
  await setQuoteRequestStatus(store.id, id, status);
  revalidatePath("/dashboard/quotes");
}
