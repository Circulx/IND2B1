import "server-only";
import bcrypt from "bcryptjs";
import { themeFromTemplateForSeed as themeFromTemplate } from "./seed-theme";
import { CounterModel, DiscountModel, MetaModel, OrderModel, ProductModel, StoreModel, UserModel } from "./models";
import type { Order, Product, Store } from "../types";

/**
 * Demo data, inserted once into an empty database the first time the app
 * connects. Turn off with SEED_DEMO_DATA=false. Reset with `npm run db:reset`.
 *
 * Demo sign-ins (shown on /login in development):
 *   Store owner   priya@example.in  /  Demo@1234   (owns Priya Handlooms and Shreeji Steel Tubes)
 *   Platform admin neha@ind2b.com   /  Admin@1234
 */
export const DEMO_ACCOUNTS = [
  { email: "priya@example.in", password: "Demo@1234", label: "Store owner · Priya Sharma (2 stores)" },
  { email: "neha@ind2b.com", password: "Admin@1234", label: "IND2B platform admin · Neha Kulkarni" },
];

export async function ensureSeed() {
  if (process.env.SEED_DEMO_DATA === "false") return;
  if (await MetaModel.exists({ _id: "seed" })) return;
  if (await StoreModel.exists({})) { await MetaModel.updateOne({ _id: "seed" }, { $set: { at: new Date() } }, { upsert: true }); return; }
  try {
    await MetaModel.create({ _id: "seed", at: new Date() });   // acts as a lock: only one process seeds
  } catch {
    return;
  }
  await seed();
  console.info("[ind2b] Seeded demo data: 3 users, 3 stores, products and orders.");
}

async function seed() {
  const r = (rupees: number) => Math.round(rupees * 100);
  const now = () => new Date().toISOString();

  const priya: Store = {
    id: "st_priya", slug: "priyahandlooms", name: "Priya Handlooms", ownerId: "usr_priya", category: "fashion", plan: "grow", status: "active",
    templateId: "vastra", theme: themeFromTemplate("vastra", 7), installedApps: ["razorpay", "cod", "gst-invoice", "whatsapp-chat", "product-reviews", "shiprocket"],
    settings: { email: "hello@priyahandlooms.in", phone: "+91 98220 41736", address: "[ADDRESS], Pune", state: "Maharashtra", gstin: "27ABCPP1234A1Z5", currency: "INR", pricesIncludeGst: true, shipping: { flatRatePaise: r(79), freeAbovePaise: r(999) }, payments: { razorpay: true, cod: true, upi: true } },
    kyc: "verified", createdAt: now(), customDomain: { host: "www.priyahandlooms.in", status: "verified" },
  };
  const shreeji: Store = {
    id: "st_shreeji", slug: "shreejisteel", name: "Shreeji Steel Tubes", ownerId: "usr_priya", category: "b2b", plan: "pro", status: "active",
    templateId: "udyog", theme: themeFromTemplate("udyog", 14), installedApps: ["razorpay", "gst-invoice", "b2b-wholesale", "whatsapp-chat"],
    settings: { email: "sales@shreejisteel.in", phone: "+91 [PHONE]", address: "[MILL ADDRESS], Raipur", state: "Chhattisgarh", gstin: "22AAFCS4821K1Z2", currency: "INR", pricesIncludeGst: false, shipping: { flatRatePaise: r(1500), freeAbovePaise: null }, payments: { razorpay: true, cod: false, upi: true } },
    kyc: "verified", createdAt: now(),
  };
  const kiran: Store = {
    id: "st_kiran", slug: "kiranfresh", name: "Kiran Fresh Mart", ownerId: "usr_kiran", category: "grocery", plan: "starter", status: "setup",
    templateId: "kirana", theme: themeFromTemplate("kirana"), installedApps: ["razorpay", "cod"],
    settings: { email: "kiran@example.in", phone: "+91 [PHONE]", address: "[ADDRESS], Indore", state: "Madhya Pradesh", currency: "INR", pricesIncludeGst: true, shipping: { flatRatePaise: r(30), freeAbovePaise: r(499) }, payments: { razorpay: true, cod: true, upi: true } },
    kyc: "pending", createdAt: now(),
  };

  const p = (storeId: string, handle: string, title: string, collection: string, gstRate: number, variants: [string, number, number?, number?][], description: string, extra: Partial<Product> = {}): Product => ({
    id: `pr_${handle}`, storeId, handle, title, description, status: "active", collection, tags: [], images: [], gstRate, createdAt: now(),
    variants: variants.map(([vt, price, compare, stock], i) => ({ id: `v_${handle}_${i}`, title: vt, sku: `${handle.slice(0, 6).toUpperCase()}-${i + 1}`, pricePaise: r(price), compareAtPaise: compare ? r(compare) : undefined, stock: stock ?? 25 })),
    ...extra,
  });

  const products: Product[] = [
    p("st_priya", "chanderi-silk-saree-rani", "Chanderi Silk Saree — Rani Pink", "sarees", 5, [["Free size", 4890, 5990, 12]], "Handwoven Chanderi silk-cotton with zari border. Comes with unstitched blouse piece. Dry clean only."),
    p("st_priya", "kota-doria-saree-mint", "Kota Doria Saree — Mint", "sarees", 5, [["Free size", 2450, 2990, 18]], "Lightweight Kota Doria cotton, perfect for summer. Hand block printed pallu."),
    p("st_priya", "ikat-cotton-kurta-indigo", "Ikat Cotton Kurta — Indigo", "kurtas", 5, [["S", 1290, 1590, 8], ["M", 1290, 1590, 11], ["L", 1290, 1590, 6], ["XL", 1290, 1590, 3]], "Straight-cut handloom ikat kurta with side pockets. 100% cotton."),
    p("st_priya", "block-print-dupatta", "Hand Block Print Dupatta", "dupattas", 5, [["Free size", 790, 990, 30]], "Sanganeri block print on soft mulmul cotton."),
    p("st_priya", "banarasi-silk-saree-gold", "Banarasi Silk Saree — Gold Zari", "sarees", 5, [["Free size", 8990, 10990, 4]], "Pure silk Banarasi with antique gold zari. A festive heirloom."),
    p("st_priya", "linen-kurta-set-sand", "Linen Kurta Set — Sand", "kurtas", 12, [["M", 2690, undefined, 5], ["L", 2690, undefined, 7]], "Relaxed linen kurta with matching pants."),
    p("st_shreeji", "ms-erw-pipe-40nb-medium", "MS ERW Pipe 40 NB, Medium, IS 1239", "pipes", 18, [["6 m length", 1398, undefined, 400]], "Black varnished ERW pipe, 48.3 mm OD, 3.25 mm wall. Mill test certificate with every dispatch.", { tiers: [{ minQty: 50, pricePaise: r(1360) }, { minQty: 200, pricePaise: r(1320) }] }),
    p("st_shreeji", "gi-pipe-32nb-medium", "GI Pipe 32 NB, Medium, IS 1239", "pipes", 18, [["6 m length", 1520, undefined, 250]], "Hot-dip galvanised for water lines.", { tiers: [{ minQty: 50, pricePaise: r(1480) }] }),
    p("st_shreeji", "shs-40x40x3", "Square Hollow Section 40×40×3 mm", "hollow-sections", 18, [["6 m length", 1890, undefined, 180]], "YST 310 structural hollow section, IS 4923."),
    p("st_kiran", "basmati-rice-5kg", "Basmati Rice, 5 kg", "staples", 5, [["5 kg", 649, 749, 40]], "Aged long-grain basmati."),
    p("st_kiran", "toor-dal-1kg", "Toor Dal, 1 kg", "staples", 5, [["1 kg", 169, 185, 60]], "Unpolished toor dal."),
  ];

  const order = (n: number, storeId: string, name: string, city: string, state: string, lines: [Product, number][], method: Order["payment"]["method"], status: Order["status"], daysAgo: number): Order => {
    const ol = lines.map(([pr, qty]) => ({ productId: pr.id, variantId: pr.variants[0]!.id, title: pr.title, variantTitle: pr.variants[0]!.title, qty, unitPricePaise: pr.variants[0]!.pricePaise }));
    const subtotal = ol.reduce((a, l) => a + l.qty * l.unitPricePaise, 0);
    const shipping = subtotal >= r(999) ? 0 : r(79);
    const tax = Math.round(subtotal - subtotal / 1.05);
    return {
      id: `ord_${storeId}_${n}`, number: n, storeId, createdAt: new Date(Date.now() - daysAgo * 864e5).toISOString(),
      customer: { name, email: `${name.split(" ")[0]!.toLowerCase()}@example.in`, phone: "+91 90000 00000", address: "[ADDRESS]", city, pincode: "411001", state },
      lines: ol, subtotalPaise: subtotal, shippingPaise: shipping, discountPaise: 0, taxPaise: tax, totalPaise: subtotal + shipping,
      payment: { method, status: method === "cod" ? "cod" : "paid" }, status,
    };
  };
  const pp = (h: string) => products.find((x) => x.handle === h)!;
  const orders: Order[] = [
    order(1042, "st_priya", "Meera Iyer", "Bengaluru", "Karnataka", [[pp("chanderi-silk-saree-rani"), 1]], "upi", "unfulfilled", 0),
    order(1041, "st_priya", "Ritika Shah", "Pune", "Maharashtra", [[pp("ikat-cotton-kurta-indigo"), 2], [pp("block-print-dupatta"), 1]], "cod", "unfulfilled", 0),
    order(1040, "st_priya", "Anjali Verma", "Delhi", "Delhi", [[pp("kota-doria-saree-mint"), 1]], "card", "fulfilled", 1),
    order(1039, "st_priya", "Sana Khan", "Hyderabad", "Telangana", [[pp("banarasi-silk-saree-gold"), 1]], "upi", "delivered", 3),
    order(1038, "st_priya", "Divya Nair", "Kochi", "Kerala", [[pp("block-print-dupatta"), 3]], "upi", "delivered", 4),
    order(1037, "st_priya", "Ritika Shah", "Pune", "Maharashtra", [[pp("linen-kurta-set-sand"), 1]], "netbanking", "returned", 9),
  ];

  const users = [
  { _id: "usr_priya", email: "priya@example.in", name: "Priya Sharma", phone: "+91 98220 41736", role: "merchant", password: "Demo@1234" },
  { _id: "usr_kiran", email: "kiran@example.in", name: "Kiran Patel", phone: "", role: "merchant", password: "Demo@1234" },
  { _id: "usr_neha", email: "neha@ind2b.com", name: "Neha Kulkarni", phone: "", role: "admin", password: "Admin@1234" },
  ];
  await UserModel.insertMany(await Promise.all(users.map(async ({ password, ...u }) => ({ ...u, passwordHash: await bcrypt.hash(password, 10), createdAt: new Date() }))));

  const stores = [priya, shreeji, kiran];
  await StoreModel.insertMany(stores.map(({ id, createdAt, ...s }) => ({ ...s, _id: id, createdAt: new Date(createdAt), draftTheme: null, customDomain: s.customDomain ?? null })));
  await ProductModel.insertMany(products.map(({ id, createdAt, collection, ...p }) => ({ ...p, _id: id, collectionHandle: collection, createdAt: new Date(createdAt) })));
  await OrderModel.insertMany(orders.map(({ id, createdAt, ...o }) => ({ ...o, _id: id, createdAt: new Date(createdAt) })));
  await DiscountModel.insertMany([
  { storeId: "st_priya", code: "WELCOME10", type: "percent", value: 10, minSubtotalPaise: r(999), active: true, uses: 38 },
  { storeId: "st_priya", code: "FESTIVE500", type: "fixed", value: r(500), minSubtotalPaise: r(4999), active: false, uses: 112 },
  ]);
  await CounterModel.insertMany(stores.map((s) => ({ _id: `order:${s.id}`, seq: Math.max(1000, ...orders.filter((o) => o.storeId === s.id).map((o) => o.number)) })));
}
