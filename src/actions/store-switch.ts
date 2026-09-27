"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_STORE_COOKIE } from "@/lib/auth/session";
import { requireStore } from "@/lib/merchant";

/** Switch the store being managed. Only stores the merchant owns are accepted. */
export async function switchStore(formData: FormData) {
  const { stores } = await requireStore();
  const id = String(formData.get("storeId") ?? "");
  if (stores.some((s) => s.id === id)) (await cookies()).set(ACTIVE_STORE_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
