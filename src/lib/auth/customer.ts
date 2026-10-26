import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createSession, findActiveSession, revokeSession } from "../services/sessions";
import { getCustomerAccount } from "../services/customers";
import { ipFrom } from "../security";
import type { CustomerAccount, CustomerSession } from "../types";
import { customerCookieName, customerCookieOptions, signCustomerToken, verifyCustomerToken } from "./session";

/**
 * Shopper sign-in for one store. The cookie holds a JWT whose audience is that
 * store, naming a server-side session of kind "customer" for the same store.
 */

/** The shopper signed in to this store, or null. Cached per request and store. */
export const getCustomerSession = cache(async (storeId: string): Promise<CustomerSession | null> => {
  const token = (await cookies()).get(customerCookieName(storeId))?.value;
  const claims = await verifyCustomerToken(token, storeId);
  if (!claims) return null;
  const [s, c] = await Promise.all([findActiveSession(claims.sid, claims.customerId, "customer", storeId), getCustomerAccount(storeId, claims.customerId)]);
  if (!s || !c || c.status === "disabled") return null;
  return { customerId: c.id, storeId, name: c.name, email: c.email, sid: claims.sid };
});

/** Creates a server-side session and sets the store's shopper cookie. Call only from a Server Action or route handler. */
export async function startCustomerSession(c: CustomerAccount) {
  const h = await headers();
  const sid = await createSession(c.id, "customer", { ip: ipFrom(h), userAgent: h.get("user-agent") ?? "" }, { kind: "customer", storeId: c.storeId });
  const token = await signCustomerToken({ customerId: c.id, storeId: c.storeId, name: c.name, email: c.email, sid });
  (await cookies()).set(customerCookieName(c.storeId), token, customerCookieOptions);
}

/** Ends this device's shopper session for the store and clears the cookie. */
export async function endCustomerSession(storeId: string) {
  const jar = await cookies();
  const claims = await verifyCustomerToken(jar.get(customerCookieName(storeId))?.value, storeId);
  if (claims) await revokeSession(claims.sid);
  jar.set(customerCookieName(storeId), "", { ...customerCookieOptions, maxAge: 0 });
}
