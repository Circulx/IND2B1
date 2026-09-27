"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore, setAppStatus, updateStore } from "@/lib/services";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";

/**
 * All admin mutations: re-check the role (Server Actions are public POST
 * endpoints), validate input, call the owning service, write the audit log.
 */

const storeAction = z.object({ storeId: z.string().min(1), action: z.enum(["suspend", "restore"]), reason: z.string().trim().max(500).optional() });
export async function storeStatusAction(fd: FormData) {
  const s = await requireAdmin();
  const p = storeAction.safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  const store = await getStore(p.data.storeId);
  if (!store) return;
  if (p.data.action === "suspend" && !p.data.reason) return; // suspensions need a reason the merchant can act on
  await updateStore(store.id, { status: p.data.action === "suspend" ? "suspended" : store.theme.version > 1 || store.kyc === "verified" ? "active" : "setup" });
  await audit(s, `store.${p.data.action}`, store.id, { reason: p.data.reason });
  revalidatePath("/admin/stores");
  revalidatePath(`/admin/stores/${store.id}`);
}

const kyc = z.object({ storeId: z.string().min(1), decision: z.enum(["approve", "reject"]), note: z.string().trim().max(1000).optional() });
export async function decideKyc(fd: FormData) {
  const s = await requireAdmin();
  const p = kyc.safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  if (p.data.decision === "reject" && !p.data.note) return;
  const store = await getStore(p.data.storeId);
  if (!store || store.kyc !== "pending") return;
  await updateStore(store.id, p.data.decision === "approve" ? { kyc: "verified", kycNote: "" } : { kyc: "rejected", kycNote: p.data.note });
  await audit(s, `kyc.${p.data.decision}`, store.id, { note: p.data.note });
  revalidatePath("/admin/kyc");
  revalidatePath("/admin");
}

const review = z.object({ appId: z.string().min(1), decision: z.enum(["published", "rejected", "in_review"]), note: z.string().trim().max(1000).optional() });
export async function reviewApp(fd: FormData) {
  const s = await requireAdmin();
  const p = review.safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  if (p.data.decision === "rejected" && !p.data.note) return;
  await setAppStatus(p.data.appId, p.data.decision, p.data.note);
  await audit(s, `app.${p.data.decision}`, p.data.appId, { note: p.data.note });
  revalidatePath("/admin/apps");
}
