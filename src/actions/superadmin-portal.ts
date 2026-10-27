"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  APPS, PLANS, adminSetPassword, createUser, deleteDiscount, deleteProduct, getProduct, getStore, getUser, installApp, passwordProblem, recordLogin,
  revokeOwnSession, revokeUserSessions, setAppStatus, setCustomerStatus, setStaffRole, setUserStatus, toggleDiscount, uninstallApp, updateStore,
  isPlanId, updatePlan, upsertProduct, verifyLogin, type OrderStatus, type PaymentStatus,
} from "@/lib/services";
import {
  deleteCustomerAccount, deleteStoreCascade, deleteUserAccount, forceOrderStatus, getAnyOrder, productStoreId, revokeAnySession, revokeSessionsByScope,
  setOrderPaymentStatus, signOutCustomerEverywhere, transferStoreOwner, updateStoreProfile, updateUserAccount,
} from "@/lib/services/platform";
import { createSession, revokeSession } from "@/lib/services/sessions";
import { completePasswordReset } from "@/actions/password-reset";
import { deleteUnusedMedia } from "@/lib/media";
import { ACTIVE_STORE_COOKIE, SESSION_COOKIE, cookieOptions, safeNext, signSession, verifySession } from "@/lib/auth/session";
import { ipFrom, rateLimit, waitText } from "@/lib/security";
import { audit } from "@/lib/audit";
import { PORTAL, PORTAL_LOGIN, portalPath, requireSuperAdminPortal, withFlash } from "@/lib/superadmin";

/**
 * Super admin control centre (/superadmin): sign-in and every mutation.
 *
 * Server Actions are public POST endpoints, so each one re-checks that the caller
 * is a signed-in, active super admin (requireSuperAdminPortal), validates its input,
 * refuses changes that would lock the platform out (yourself, the last super admin),
 * writes the audit log and redirects back with a flash message.
 */

export type PortalState = { ok?: string; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;
export type PortalLoginState = { error?: string; values?: Record<string, string> };

const ERR: Record<string, string> = {
  not_found: "That record no longer exists.",
  not_staff: "Merchant accounts cannot be turned into staff. Create a separate staff account.",
  last_superadmin: "This is the last active super admin. Add another super admin first.",
  email_taken: "An account with this email already exists.",
  owns_stores: "This merchant still owns stores. Transfer or delete the stores first.",
  owner_not_found: "No account exists with that email.",
  owner_not_merchant: "The new owner must be a merchant account, not staff.",
  owner_disabled: "The new owner's account is disabled. Enable it first.",
  same_owner: "That merchant already owns this store.",
  unknown_app: "This plugin is not published, so it cannot be installed.",
  status_changed: "Someone else changed this order a moment ago. Check it and try again.",
};
const errKey = (e: unknown) => (e instanceof Error && ERR[e.message] ? e.message : "failed");
const errText = (e: unknown) => ERR[errKey(e)] ?? "Something went wrong. Please try again.";

const back = (fd: FormData, fallback: string) => portalPath(fd.get("back"), fallback);
const done = (fd: FormData, fallback: string, key: string): never => redirect(withFlash(back(fd, fallback), "ok", key));
const fail = (fd: FormData, fallback: string, key: string): never => redirect(withFlash(back(fd, fallback), "error", key));
const refresh = () => revalidatePath(PORTAL, "layout");

const storeId = z.string().regex(/^st_[A-Za-z0-9_-]{1,60}$/);
const userId = z.string().regex(/^usr_[A-Za-z0-9_-]{2,40}$/);
const customerId = z.string().regex(/^cus_[A-Za-z0-9_-]{2,40}$/);
const orderId = z.string().regex(/^ord_[A-Za-z0-9_-]{1,120}$/);
const productId = z.string().regex(/^pr_[A-Za-z0-9_-]{1,60}$/);
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/* ================================================================== sign-in */
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email."),
  password: z.string().min(1, "Enter your password.").max(128),
});

/** /superadmin/login — super admins only. Admins are pointed to /admin/login. */
export async function superAdminLogIn(_prev: PortalLoginState, fd: FormData): Promise<PortalLoginState> {
  const values = { email: field(fd, "email").slice(0, 254) };
  const p = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { error: p.error.issues[0]?.message, values };
  const h = await headers();
  const ip = ipFrom(h);
  const [perEmail, perIp] = await Promise.all([
    rateLimit(`login:superadmin:email:${p.data.email}`, 5, 15 * 60),
    rateLimit(`login:superadmin:ip:${ip}`, 20, 15 * 60),
  ]);
  if (!perEmail.ok || !perIp.ok) return { error: `Too many sign-in attempts. Try again in ${waitText(Math.max(perEmail.retryAfterS, perIp.retryAfterS))}.`, values };

  const user = await verifyLogin(p.data.email, p.data.password);
  if (!user) return { error: "Email or password is incorrect.", values };
  if (user.role === "merchant") return { error: "Email or password is incorrect.", values };   // never confirm merchant emails here
  if (user.status === "disabled") return { error: "This account has been disabled. Contact another super admin.", values };
  if (user.role !== "superadmin") return { error: "This portal is for super admins only. IND2B admins sign in at /admin/login.", values };

  // Start a fresh session on this device (any earlier session in this browser is ended).
  const jar = await cookies();
  const previous = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (previous) await revokeSession(previous.sid);
  const sid = await createSession(user.id, user.role, { ip, userAgent: h.get("user-agent") ?? "" });
  jar.set(SESSION_COOKIE, await signSession({ userId: user.id, name: user.name, email: user.email, role: user.role, sid }), cookieOptions);
  jar.delete(ACTIVE_STORE_COOKIE);
  await recordLogin(user.id);
  await audit({ userId: user.id, name: user.name, email: user.email, role: user.role }, "auth.superadmin_portal_login", user.id, { ip });
  const next = safeNext(field(fd, "next"), PORTAL);
  redirect(portalPath(next, PORTAL));
}

/** Password reset from /superadmin/forgot-password: same staff flow, but returns to this portal's sign-in page. */
export async function superAdminCompleteReset(prev: Parameters<typeof completePasswordReset>[1], fd: FormData) {
  try {
    return await completePasswordReset("staff", prev, fd);
  } catch (e) {
    const digest = (e as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) redirect(`${PORTAL_LOGIN}?reset=1`);
    throw e;
  }
}

/* ================================================================== stores */
const STORE_STATUS = z.enum(["active", "setup", "suspended"]);

export async function setStoreStatusAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = storeId.safeParse(fd.get("storeId"));
  const status = STORE_STATUS.safeParse(fd.get("status"));
  const reason = field(fd, "reason").trim().slice(0, 500);
  if (!id.success || !status.success) fail(fd, `${PORTAL}/stores`, "invalid");
  if (status.data === "suspended" && !reason) fail(fd, `${PORTAL}/stores/${id.data}`, "reason_required");
  const store = await getStore(id.data!);
  if (!store) fail(fd, `${PORTAL}/stores`, "not_found");
  await updateStore(store!.id, { status: status.data! });
  await audit(s, status.data === "suspended" ? "store.suspend" : "store.status_changed", store!.id, { from: store!.status, to: status.data, reason: reason || undefined });
  refresh();
  done(fd, `${PORTAL}/stores/${store!.id}`, "store_status");
}

export async function setStorePlanAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = storeId.safeParse(fd.get("storeId"));
  const plan = field(fd, "plan");
  if (!id.success || !PLANS.some((p) => p.id === plan)) fail(fd, `${PORTAL}/stores`, "invalid");
  const store = await getStore(id.data!);
  if (!store) fail(fd, `${PORTAL}/stores`, "not_found");
  if (store!.plan !== plan) {
    await updateStore(store!.id, { plan: plan as (typeof PLANS)[number]["id"] });
    await audit(s, "store.plan_changed", store!.id, { from: store!.plan, to: plan });
  }
  refresh();
  done(fd, `${PORTAL}/stores/${store!.id}`, "plan");
}

export async function decideStoreKycAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = storeId.safeParse(fd.get("storeId"));
  const decision = z.enum(["approve", "reject", "reset"]).safeParse(fd.get("decision"));
  const note = field(fd, "note").trim().slice(0, 1000);
  if (!id.success || !decision.success) fail(fd, `${PORTAL}/kyc`, "invalid");
  if (decision.data === "reject" && !note) fail(fd, `${PORTAL}/kyc`, "note_required");
  const store = await getStore(id.data!);
  if (!store) fail(fd, `${PORTAL}/kyc`, "not_found");
  await updateStore(store!.id, decision.data === "approve" ? { kyc: "verified", kycNote: "" } : decision.data === "reject" ? { kyc: "rejected", kycNote: note } : { kyc: "not_started", kycNote: "" });
  await audit(s, `kyc.${decision.data}`, store!.id, { from: store!.kyc, note: note || undefined });
  refresh();
  done(fd, `${PORTAL}/kyc`, `kyc_${decision.data}`);
}

const STATES = z.string().trim().min(2).max(60);
const storeProfile = z.object({
  name: z.string().trim().min(2, "Enter the store name.").max(60),
  category: z.enum(["fashion", "electronics", "grocery", "beauty", "home", "food", "b2b", "other"]),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email."),
  phone: z.string().trim().max(20).regex(/^[0-9+\s-]*$/, "Use digits only."),
  address: z.string().trim().max(300),
  state: STATES,
  gstin: z.string().trim().toUpperCase().regex(/^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])?$/, "GSTIN is 15 characters, e.g. 27ABCDE1234F1Z5."),
});

export async function editStoreAction(id: string, _prev: PortalState, fd: FormData): Promise<PortalState> {
  const s = await requireSuperAdminPortal();
  const sid = storeId.parse(id);
  const p = storeProfile.safeParse(Object.fromEntries(["name", "category", "email", "phone", "address", "state", "gstin"].map((k) => [k, fd.get(k) ?? ""])));
  if (!p.success) return { fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  try {
    await updateStoreProfile(sid, p.data);
  } catch (e) {
    return { error: errText(e) };
  }
  await audit(s, "store.profile_edited", sid, p.data);
  refresh();
  return { ok: "Store details saved." };
}

export async function transferStoreAction(id: string, _prev: PortalState, fd: FormData): Promise<PortalState> {
  const s = await requireSuperAdminPortal();
  const sid = storeId.parse(id);
  const email = z.string().trim().toLowerCase().max(254).email().safeParse(fd.get("email"));
  if (!email.success) return { fieldErrors: { email: "Enter the new owner's email." } };
  try {
    const r = await transferStoreOwner(sid, email.data);
    await audit(s, "store.owner_transferred", sid, r);
  } catch (e) {
    return { error: errText(e) };
  }
  refresh();
  return { ok: `Store transferred to ${email.data}.` };
}

export async function deleteStoreAction(id: string, _prev: PortalState, fd: FormData): Promise<PortalState> {
  const s = await requireSuperAdminPortal();
  const sid = storeId.parse(id);
  const store = await getStore(sid);
  if (!store) return { error: ERR.not_found };
  if (field(fd, "confirm").trim().toLowerCase() !== store.slug) return { fieldErrors: { confirm: `Type ${store.slug} to confirm.` } };
  const r = await deleteStoreCascade(sid);
  await audit(s, "store.deleted", sid, r);
  refresh();
  redirect(withFlash(`${PORTAL}/stores`, "ok", "store_deleted"));
}

export async function storeDomainAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = storeId.safeParse(fd.get("storeId"));
  const op = z.enum(["verify", "unverify", "remove"]).safeParse(fd.get("op"));
  if (!id.success || !op.success) fail(fd, `${PORTAL}/stores`, "invalid");
  const store = await getStore(id.data!);
  if (!store?.customDomain) fail(fd, `${PORTAL}/stores/${id.data}`, "not_found");
  const host = store!.customDomain!.host;
  await updateStore(store!.id, { customDomain: op.data === "remove" ? undefined : { host, status: op.data === "verify" ? "verified" : "pending" } });
  await audit(s, `store.domain_${op.data}`, store!.id, { host });
  refresh();
  done(fd, `${PORTAL}/stores/${store!.id}`, `domain_${op.data}`);
}

export async function storeAppAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = storeId.safeParse(fd.get("storeId"));
  const appId = field(fd, "appId");
  const op = z.enum(["install", "uninstall"]).safeParse(fd.get("op"));
  if (!id.success || !op.success || !APPS.some((a) => a.id === appId)) fail(fd, `${PORTAL}/stores`, "invalid");
  try {
    if (op.data === "install") await installApp(id.data!, appId); else await uninstallApp(id.data!, appId);
  } catch (e) {
    fail(fd, `${PORTAL}/stores/${id.data}`, errKey(e));
  }
  await audit(s, `store.app_${op.data}`, id.data!, { appId });
  refresh();
  done(fd, `${PORTAL}/stores/${id.data}`, `app_${op.data}`);
}

/* ================================================================== orders */
const ORDER_STATUS = z.enum(["unfulfilled", "fulfilled", "delivered", "cancelled", "returned"]);
const PAYMENT_STATUS = z.enum(["paid", "pending", "cod", "refunded"]);

export async function forceOrderStatusAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = orderId.safeParse(fd.get("orderId"));
  const status = ORDER_STATUS.safeParse(fd.get("status"));
  if (!id.success || !status.success) fail(fd, `${PORTAL}/orders`, "invalid");
  try {
    const r = await forceOrderStatus(id.data!, status.data! as OrderStatus);
    await audit(s, "order.status_override", id.data!, { storeId: r.storeId, from: "previous" in r ? r.previous : r.status, to: status.data, restocked: "restocked" in r ? r.restocked : undefined });
    if ("restocked" in r && r.restocked === false) { refresh(); fail(fd, `${PORTAL}/orders/${id.data}`, "restock_failed"); }
  } catch (e) {
    if ((e as { digest?: unknown } | null)?.digest) throw e;
    fail(fd, `${PORTAL}/orders/${id.data}`, errKey(e));
  }
  refresh();
  done(fd, `${PORTAL}/orders/${id.data}`, "order_status");
}

export async function setOrderPaymentAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = orderId.safeParse(fd.get("orderId"));
  const status = PAYMENT_STATUS.safeParse(fd.get("payment"));
  if (!id.success || !status.success) fail(fd, `${PORTAL}/orders`, "invalid");
  const order = await getAnyOrder(id.data!);
  if (!order) fail(fd, `${PORTAL}/orders`, "not_found");
  await setOrderPaymentStatus(order!.id, status.data! as PaymentStatus);
  await audit(s, "order.payment_status_set", order!.id, { storeId: order!.storeId, from: order!.payment.status, to: status.data });
  refresh();
  done(fd, `${PORTAL}/orders/${order!.id}`, "payment_status");
}

/* ================================================================== products */
export async function setProductStatusAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = productId.safeParse(fd.get("productId"));
  const status = z.enum(["active", "draft"]).safeParse(fd.get("status"));
  if (!id.success || !status.success) fail(fd, `${PORTAL}/products`, "invalid");
  const sid = await productStoreId(id.data!);
  const p = sid ? await getProduct(sid, id.data!) : undefined;
  if (!p) fail(fd, `${PORTAL}/products`, "not_found");
  const { id: pid, storeId: _s, createdAt: _c, handle: _h, ...rest } = p!;
  await upsertProduct(p!.storeId, { ...rest, id: pid, status: status.data! });
  await audit(s, status.data === "draft" ? "product.unpublished" : "product.published", pid, { storeId: p!.storeId, title: p!.title });
  refresh();
  done(fd, `${PORTAL}/products`, `product_${status.data}`);
}

export async function deleteProductAnyAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = productId.safeParse(fd.get("productId"));
  if (!id.success) fail(fd, `${PORTAL}/products`, "invalid");
  const sid = await productStoreId(id.data!);
  if (!sid) fail(fd, `${PORTAL}/products`, "not_found");
  const imageIds = await deleteProduct(sid!, id.data!);
  if (imageIds.length) await deleteUnusedMedia(sid!, imageIds);
  await audit(s, "product.deleted", id.data!, { storeId: sid });
  refresh();
  done(fd, `${PORTAL}/products`, "product_deleted");
}

/* ================================================================== discount codes */
export async function discountAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = storeId.safeParse(fd.get("storeId"));
  const code = z.string().regex(/^[A-Z0-9]{1,20}$/).safeParse(field(fd, "code").toUpperCase());
  const op = z.enum(["toggle", "delete"]).safeParse(fd.get("op"));
  if (!id.success || !code.success || !op.success) fail(fd, `${PORTAL}/discounts`, "invalid");
  if (op.data === "toggle") await toggleDiscount(id.data!, code.data!); else await deleteDiscount(id.data!, code.data!);
  await audit(s, `discount.${op.data === "toggle" ? "toggled" : "deleted"}`, `${id.data}:${code.data}`);
  refresh();
  done(fd, `${PORTAL}/discounts`, `discount_${op.data}`);
}

/* ================================================================== platform accounts */
const accountSchema = z.object({
  name: z.string().trim().min(2, "Enter the name.").max(80),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email."),
  phone: z.string().trim().max(20).regex(/^[0-9+\s-]*$/, "Use digits only."),
  role: z.enum(["merchant", "admin", "superadmin"]),
  password: z.string().max(128),
});

export async function createAccountAction(_prev: PortalState, fd: FormData): Promise<PortalState> {
  const s = await requireSuperAdminPortal();
  const values = { name: field(fd, "name").slice(0, 80), email: field(fd, "email").slice(0, 254), phone: field(fd, "phone").slice(0, 20), role: field(fd, "role") || "merchant" };
  const p = accountSchema.safeParse({ name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") ?? "", role: fd.get("role"), password: fd.get("password") ?? "" });
  if (!p.success) return { fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])), values };
  const problem = passwordProblem(p.data.password, p.data.email, { strong: p.data.role !== "merchant" });
  if (problem) return { fieldErrors: { password: problem }, values };
  try {
    const u = await createUser({ email: p.data.email, name: p.data.name, phone: p.data.phone, password: p.data.password, role: p.data.role, emailVerified: true });
    await audit(s, p.data.role === "merchant" ? "user.merchant_created" : "user.staff_created", u.id, { email: u.email, role: u.role });
  } catch (e) {
    return { error: errText(e), values };
  }
  refresh();
  const label = p.data.role === "merchant" ? "Merchant" : p.data.role === "superadmin" ? "Super admin" : "Admin";
  return { ok: `${label} account ${p.data.email} created. Share the password privately and ask them to change it after signing in.` };
}

const editSchema = z.object({
  name: z.string().trim().min(2, "Enter the name.").max(80),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email."),
  phone: z.string().trim().max(20).regex(/^[0-9+\s-]*$/, "Use digits only."),
});

export async function editAccountAction(id: string, _prev: PortalState, fd: FormData): Promise<PortalState> {
  const s = await requireSuperAdminPortal();
  const uid = userId.parse(id);
  const p = editSchema.safeParse({ name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") ?? "" });
  if (!p.success) return { fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  try {
    const r = await updateUserAccount(uid, p.data);
    await audit(s, "user.profile_edited", uid, r);
    refresh();
    if (uid === s.userId && r.before.email !== r.after.email) redirect(`${PORTAL_LOGIN}?expired=1`);
    return { ok: r.before.email !== r.after.email ? "Saved. The email changed, so the user was signed out everywhere." : "Saved." };
  } catch (e) {
    if ((e as { digest?: unknown } | null)?.digest) throw e;
    return { error: errText(e) };
  }
}

export async function setAccountPasswordAction(id: string, _prev: PortalState, fd: FormData): Promise<PortalState> {
  const s = await requireSuperAdminPortal();
  const uid = userId.parse(id);
  if (uid === s.userId) return { error: "Change your own password under My account." };
  const user = await getUser(uid);
  if (!user) return { error: ERR.not_found };
  const pw = field(fd, "password");
  if (pw !== field(fd, "confirm")) return { fieldErrors: { confirm: "The two passwords do not match." } };
  const problem = passwordProblem(pw, user.email, { strong: user.role !== "merchant" });
  if (problem) return { fieldErrors: { password: problem } };
  await adminSetPassword(uid, pw);
  await audit(s, "user.password_set", uid);
  refresh();
  return { ok: "Password set. The user was signed out of every device." };
}

export async function accountControlAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = userId.safeParse(fd.get("userId"));
  const op = z.enum(["enable", "disable", "make_admin", "make_superadmin", "signout", "delete"]).safeParse(fd.get("op"));
  if (!id.success || !op.success) fail(fd, `${PORTAL}/users`, "invalid");
  const uid = id.data!;
  const self = uid === s.userId;
  if (self && op.data !== "signout") fail(fd, `${PORTAL}/users/${uid}`, "self");
  try {
    switch (op.data) {
      case "enable": case "disable":
        await setUserStatus(uid, op.data === "disable" ? "disabled" : "active");
        await audit(s, op.data === "disable" ? "user.disabled" : "user.enabled", uid);
        break;
      case "make_admin": case "make_superadmin": {
        const before = await getUser(uid);
        await setStaffRole(uid, op.data === "make_admin" ? "admin" : "superadmin");
        await audit(s, "user.role_changed", uid, { from: before?.role, to: op.data === "make_admin" ? "admin" : "superadmin" });
        break;
      }
      case "signout":
        await revokeUserSessions(uid, self ? s.sid : undefined);
        await audit(s, "user.sessions_revoked", uid);
        break;
      case "delete": {
        const r = await deleteUserAccount(uid);
        await audit(s, "user.deleted", uid, r);
        refresh();
        redirect(withFlash(`${PORTAL}/users`, "ok", "user_deleted"));
      }
    }
  } catch (e) {
    if ((e as { digest?: unknown } | null)?.digest) throw e;
    fail(fd, `${PORTAL}/users/${uid}`, errKey(e));
  }
  refresh();
  done(fd, `${PORTAL}/users/${uid}`, `user_${op.data}`);
}

export async function revokeUserDeviceAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = userId.safeParse(fd.get("userId"));
  const sid = field(fd, "sid");
  if (!id.success || !sid) fail(fd, `${PORTAL}/users`, "invalid");
  if (sid !== s.sid) await revokeOwnSession(id.data!, sid);
  await audit(s, "user.session_revoked", id.data!);
  refresh();
  done(fd, `${PORTAL}/users/${id.data}`, "device_signed_out");
}

/* ================================================================== shopper accounts */
export async function shopperAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const id = customerId.safeParse(fd.get("customerId"));
  const op = z.enum(["enable", "disable", "signout", "delete"]).safeParse(fd.get("op"));
  if (!id.success || !op.success) fail(fd, `${PORTAL}/shoppers`, "invalid");
  try {
    if (op.data === "delete") {
      const r = await deleteCustomerAccount(id.data!);
      await audit(s, "customer.deleted", id.data!, r);
    } else if (op.data === "signout") {
      await signOutCustomerEverywhere(id.data!);
      await audit(s, "customer.sessions_revoked", id.data!);
    } else {
      const c = await setCustomerStatus(id.data!, op.data === "disable" ? "disabled" : "active");
      await audit(s, op.data === "disable" ? "customer.disabled" : "customer.enabled", id.data!, { storeId: c.storeId, email: c.email });
    }
  } catch (e) {
    fail(fd, `${PORTAL}/shoppers`, errKey(e));
  }
  refresh();
  done(fd, `${PORTAL}/shoppers`, `shopper_${op.data}`);
}

/* ================================================================== plugins */
export async function pluginReviewAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const appId = field(fd, "appId");
  const decision = z.enum(["published", "rejected", "in_review"]).safeParse(fd.get("decision"));
  const note = field(fd, "note").trim().slice(0, 1000);
  if (!decision.success || !APPS.some((a) => a.id === appId)) fail(fd, `${PORTAL}/plugins`, "invalid");
  if (decision.data === "rejected" && !note) fail(fd, `${PORTAL}/plugins`, "note_required");
  await setAppStatus(appId, decision.data!, note || undefined);
  await audit(s, `app.${decision.data}`, appId, { note: note || undefined });
  refresh();
  done(fd, `${PORTAL}/plugins`, `app_${decision.data}`);
}

/* ================================================================== sessions */
export async function revokeSessionAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const sid = field(fd, "sid");
  if (!sid || sid.length > 100) fail(fd, `${PORTAL}/sessions`, "invalid");
  if (sid === s.sid) fail(fd, `${PORTAL}/sessions`, "self");
  await revokeAnySession(sid);
  await audit(s, "session.revoked", field(fd, "userId").slice(0, 60) || "unknown");
  refresh();
  done(fd, `${PORTAL}/sessions`, "session_revoked");
}

export async function revokeScopeAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const scope = z.enum(["merchants", "staff", "shoppers", "everyone"]).safeParse(fd.get("scope"));
  if (!scope.success) fail(fd, `${PORTAL}/sessions`, "invalid");
  const n = await revokeSessionsByScope(scope.data!, s.sid);
  await audit(s, "session.bulk_revoked", scope.data!, { count: n });
  refresh();
  done(fd, `${PORTAL}/sessions`, `bulk_${scope.data}`);
}

/* ================================================================== my account */
export async function signOutMyDeviceAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  const sid = field(fd, "sid");
  if (sid === s.sid) {
    await revokeSession(sid);
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(ACTIVE_STORE_COOKIE);
    redirect(PORTAL_LOGIN);
  }
  if (sid) await revokeOwnSession(s.userId, sid);
  refresh();
  done(fd, `${PORTAL}/account`, "device_signed_out");
}

export async function signOutMyOtherDevicesAction(fd: FormData) {
  const s = await requireSuperAdminPortal();
  await revokeUserSessions(s.userId, s.sid);
  refresh();
  done(fd, `${PORTAL}/account`, "others_signed_out");
}

/* ================================================================== plans (stored in MongoDB) */
const planSchema = z.object({
  name: z.string().trim().min(2, "Enter the plan name.").max(40),
  price: z.coerce.number().min(0, "Price cannot be negative.").max(10_00_000, "Price is too high."),
  fee: z.coerce.number().min(0, "Fee cannot be negative.").max(20, "Fee is too high."),
  features: z.string().max(2000),
});

export async function updatePlanAction(planId: string, _prev: PortalState, fd: FormData): Promise<PortalState> {
  const s = await requireSuperAdminPortal();
  if (!isPlanId(planId)) return { error: ERR.not_found };
  const p = planSchema.safeParse({ name: fd.get("name"), price: fd.get("price"), fee: fd.get("fee"), features: fd.get("features") ?? "" });
  if (!p.success) return { fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const features = p.data.features.split(/\r?\n/).map((f) => f.trim()).filter(Boolean).slice(0, 15).map((f) => f.slice(0, 100));
  const r = await updatePlan(planId, { name: p.data.name, pricePaise: Math.round(p.data.price * 100), transactionFeePct: Math.round(p.data.fee * 100) / 100, features });
  await audit(s, "plan.updated", planId, r);
  revalidatePath("/", "layout");
  return { ok: `${p.data.name} saved. Pricing pages, merchant settings and both admin consoles now show the new values.` };
}
