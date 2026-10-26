"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  PLANS, adminSetPassword, createUser, getStore, getUser, passwordProblem, revokeOwnSession, revokeUserSessions, setCustomerStatus,
  setStaffRole, setUserStatus, updateStore,
} from "@/lib/services";
import { audit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/admin";

/**
 * Super admin mutations (complete control of the platform). Each one re-checks
 * the role (Server Actions are public POST endpoints), validates input, protects
 * against locking the platform out (you cannot demote or disable yourself, and the
 * last active super admin always stays), and writes the audit log.
 */

export type SuperState = { ok?: string; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

const FRIENDLY: Record<string, string> = {
  not_found: "That account no longer exists.",
  not_staff: "Merchant accounts cannot be turned into staff. Create a separate staff account.",
  last_superadmin: "This is the last active super admin. Add another super admin first.",
  email_taken: "An account with this email already exists.",
};
const friendly = (e: unknown) => (e instanceof Error && FRIENDLY[e.message]) || "Something went wrong. Please try again.";

const refresh = (userId?: string) => {
  revalidatePath("/admin/users");
  if (userId) revalidatePath(`/admin/users/${userId}`);
};

/* ------------------------------------------------------------------ create staff */
const staffSchema = z.object({
  name: z.string().trim().min(2, "Enter the name.").max(80),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email."),
  role: z.enum(["admin", "superadmin"]),
  password: z.string().max(128),
});
export async function createStaffAction(_prev: SuperState, fd: FormData): Promise<SuperState> {
  const s = await requireSuperAdmin();
  // Typed values are sent back on errors: React clears the form after every submit.
  const values = { name: String(fd.get("name") ?? "").slice(0, 80), email: String(fd.get("email") ?? "").slice(0, 254), role: fd.get("role") === "superadmin" ? "superadmin" : "admin" };
  const p = staffSchema.safeParse({ name: fd.get("name"), email: fd.get("email"), role: fd.get("role"), password: fd.get("password") ?? "" });
  if (!p.success) return { fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])), values };
  const problem = passwordProblem(p.data.password, p.data.email, { strong: true });
  if (problem) return { fieldErrors: { password: problem }, values };
  try {
    const u = await createUser({ email: p.data.email, name: p.data.name, phone: "", password: p.data.password, role: p.data.role });
    await audit(s, "user.staff_created", u.id, { email: u.email, role: u.role });
  } catch (e) {
    return { error: friendly(e), values };
  }
  refresh();
  return { ok: `${p.data.role === "superadmin" ? "Super admin" : "Admin"} ${p.data.email} created. Share the password privately and ask them to change it after signing in.` };
}

/* ------------------------------------------------------------------ role, status, sessions, password */
const idSchema = z.string().regex(/^usr_[A-Za-z0-9_-]{2,40}$/);

export async function changeStaffRoleAction(userId: string, role: "admin" | "superadmin") {
  const s = await requireSuperAdmin();
  const id = idSchema.parse(userId);
  if (role !== "admin" && role !== "superadmin") throw new Error("invalid_role");
  if (id === s.userId) redirect(`/admin/users/${id}?error=self`);
  let msg = "role";
  try {
    const before = await getUser(id);
    await setStaffRole(id, role);
    await audit(s, "user.role_changed", id, { from: before?.role, to: role });
  } catch (e) {
    msg = e instanceof Error && FRIENDLY[e.message] ? e.message : "failed";
  }
  refresh(id);
  redirect(`/admin/users/${id}?${msg === "role" ? "ok=role" : `error=${msg}`}`);
}

export async function setUserStatusAction(userId: string, status: "active" | "disabled") {
  const s = await requireSuperAdmin();
  const id = idSchema.parse(userId);
  if (status !== "active" && status !== "disabled") throw new Error("invalid_status");
  if (id === s.userId) redirect(`/admin/users/${id}?error=self`);
  let result = `ok=${status}`;
  try {
    await setUserStatus(id, status);
    await audit(s, status === "disabled" ? "user.disabled" : "user.enabled", id);
  } catch (e) {
    result = `error=${e instanceof Error && FRIENDLY[e.message] ? e.message : "failed"}`;
  }
  refresh(id);
  redirect(`/admin/users/${id}?${result}`);
}

/** Signs a user out of every device (all browsers and API tokens). */
export async function revokeUserSessionsAction(userId: string) {
  const s = await requireSuperAdmin();
  const id = idSchema.parse(userId);
  await revokeUserSessions(id, id === s.userId ? s.sid : undefined);   // never sign yourself out of this device
  await audit(s, "user.sessions_revoked", id);
  refresh(id);
  redirect(`/admin/users/${id}?ok=signedout`);
}

export async function revokeOneSessionAction(userId: string, sid: string) {
  const s = await requireSuperAdmin();
  const id = idSchema.parse(userId);
  if (sid !== s.sid) await revokeOwnSession(id, String(sid));
  await audit(s, "user.session_revoked", id);
  refresh(id);
}

export async function setPasswordAction(userId: string, _prev: SuperState, fd: FormData): Promise<SuperState> {
  const s = await requireSuperAdmin();
  const id = idSchema.parse(userId);
  if (id === s.userId) return { error: "Change your own password under Account & security." };
  const user = await getUser(id);
  if (!user) return { error: FRIENDLY.not_found };
  const pw = String(fd.get("password") ?? "");
  if (pw !== String(fd.get("confirm") ?? "")) return { fieldErrors: { confirm: "The two passwords do not match." } };
  const problem = passwordProblem(pw, user.email, { strong: user.role !== "merchant" });
  if (problem) return { fieldErrors: { password: problem } };
  await adminSetPassword(id, pw);
  await audit(s, "user.password_set", id);
  refresh(id);
  return { ok: "Password set. The user was signed out of every device." };
}

/* ------------------------------------------------------------------ stores */
export async function changeStorePlanAction(storeId: string, fd: FormData) {
  const s = await requireSuperAdmin();
  const plan = String(fd.get("plan") ?? "");
  const store = await getStore(String(storeId));
  if (!store || !PLANS.some((p) => p.id === plan)) return;
  if (store.plan !== plan) {
    await updateStore(store.id, { plan: plan as typeof store.plan });
    await audit(s, "store.plan_changed", store.id, { from: store.plan, to: plan });
  }
  revalidatePath(`/admin/stores/${store.id}`);
  revalidatePath("/admin/stores");
}

/* ------------------------------------------------------------------ shopper accounts */
export async function setCustomerStatusAction(customerId: string, status: "active" | "disabled") {
  const s = await requireSuperAdmin();
  if (!/^cus_[A-Za-z0-9_-]{2,40}$/.test(String(customerId)) || (status !== "active" && status !== "disabled")) throw new Error("invalid_input");
  const c = await setCustomerStatus(customerId, status);
  await audit(s, status === "disabled" ? "customer.disabled" : "customer.enabled", customerId, { storeId: c.storeId, email: c.email });
  revalidatePath("/admin/customers");
}
