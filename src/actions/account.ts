"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { changePassword, passwordProblem, revokeOwnSession, revokeSession, revokeUserSessions, updateProfile } from "@/lib/services";
import { getSession } from "@/lib/auth/server";
import { ACTIVE_STORE_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";
import { rateLimit, waitText } from "@/lib/security";

export type AccountState = { ok?: string; error?: string; fieldErrors?: Record<string, string> } | undefined;

async function me() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a 10-digit mobile number.").or(z.literal("")),
});
export async function saveProfile(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const s = await me();
  const p = profileSchema.safeParse({ name: fd.get("name"), phone: fd.get("phone") ?? "" });
  if (!p.success) return { fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  await updateProfile(s.userId, p.data);
  revalidatePath("/", "layout");
  return { ok: "Profile saved." };
}

/** Changing the password signs out every other device. */
export async function changePasswordAction(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const s = await me();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next !== String(fd.get("confirm") ?? "")) return { fieldErrors: { confirm: "The two new passwords do not match." } };
  const problem = passwordProblem(next, s.email);
  if (problem) return { fieldErrors: { next: problem } };
  const limit = await rateLimit(`pwchange:${s.userId}`, 5, 15 * 60);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${waitText(limit.retryAfterS)}.` };
  if (!(await changePassword(s.userId, current, next))) return { fieldErrors: { current: "Your current password is not correct." } };
  await revokeUserSessions(s.userId, s.sid);
  return { ok: "Password changed. Other devices were signed out." };
}

export async function signOutOtherDevices() {
  const s = await me();
  await revokeUserSessions(s.userId, s.sid);
  revalidatePath("/dashboard/account");
  revalidatePath("/admin/account");
}

export async function signOutDevice(sid: string) {
  const s = await me();
  if (sid === s.sid) {
    await revokeSession(sid);
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(ACTIVE_STORE_COOKIE);
    redirect("/login");
  }
  await revokeOwnSession(s.userId, sid);
  revalidatePath("/dashboard/account");
  revalidatePath("/admin/account");
}
