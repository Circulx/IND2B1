"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createStore, isSlugAvailable, listStoresForOwner, normaliseSlug } from "@/lib/services";
import { clientIp, rateLimit } from "@/lib/security";
import { ACTIVE_STORE_COOKIE } from "@/lib/auth/session";
import { getSession } from "@/lib/auth/server";

export async function checkSlug(raw: string) {
  const slug = normaliseSlug(String(raw).slice(0, 60));
  if (!(await rateLimit(`slug-check:${await clientIp()}`, 120, 60)).ok) return { slug, available: false };
  return { slug, available: slug.length >= 3 ? await isSlugAvailable(slug) : false };
}

const schema = z.object({
  name: z.string().trim().min(2, "Enter your store name.").max(60),
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/, "Use 3–30 lowercase letters, numbers or hyphens."),
  category: z.enum(["fashion", "electronics", "grocery", "beauty", "home", "food", "b2b", "other"]),
  templateId: z.string().min(1, "Choose a template."),
});
export type StartState = { errors?: Record<string, string>; redirectTo?: string };

/** Creates the store (with the chosen template copied into its theme) and opens the dashboard. */
export async function createStoreAction(_prev: StartState, formData: FormData): Promise<StartState> {
  const session = await getSession();
  if (!session || session.role !== "merchant") return { errors: { form: "Please sign in again." } };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { errors };
  }
  if ((await listStoresForOwner(session.userId)).length >= 10) return { errors: { form: "You can own up to 10 stores. Contact support for more." } };
  const limit = await rateLimit(`create-store:${session.userId}`, 5, 24 * 60 * 60);
  if (!limit.ok) return { errors: { form: "You have created several stores today. Try again tomorrow." } };
  if (!(await isSlugAvailable(parsed.data.slug))) return { errors: { slug: "That address is taken. Try another." } };
  let store;
  try {
    store = await createStore({ ownerId: session.userId, email: session.email, ...parsed.data });
  } catch (e) {
    if (e instanceof Error && e.message === "slug_taken") return { errors: { slug: "That address is taken. Try another." } };
    throw e;
  }
  (await cookies()).set(ACTIVE_STORE_COOKIE, store.id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard?welcome=1");
}
