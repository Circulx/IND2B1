import "server-only";
import { headers } from "next/headers";
import { connectDb } from "./db/connect";
import { RateLimitModel } from "./db/models";

/**
 * Shared security helpers: client IP, MongoDB-backed rate limits (work across
 * several app instances), and same-origin checks for route handlers.
 * Server Actions get Next.js's built-in Origin check; route handlers that accept
 * POST call assertSameOrigin() themselves.
 */

/** Client IP. Behind a proxy/load balancer set TRUST_PROXY=true so X-Forwarded-For is used. */
export function ipFrom(h: Headers) {
  if (process.env.TRUST_PROXY === "true" || process.env.NODE_ENV !== "production") {
    const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd.slice(0, 64);
    const real = h.get("x-real-ip");
    if (real) return real.slice(0, 64);
  }
  return "unknown";
}
export async function clientIp() {
  return ipFrom(await headers());
}

export type RateResult = { ok: boolean; remaining: number; retryAfterS: number };

/**
 * Fixed-window counter: at most `limit` hits per `windowS` seconds for `key`.
 * Counters live in the `ratelimits` collection and expire on their own (TTL index).
 */
export async function rateLimit(key: string, limit: number, windowS: number): Promise<RateResult> {
  await connectDb();
  const now = Date.now();
  const bucket = Math.floor(now / (windowS * 1000));
  const id = `${key}:${bucket}`.slice(0, 300);
  const expiresAt = new Date((bucket + 1) * windowS * 1000 + 60_000);
  const doc = await RateLimitModel.findOneAndUpdate(
    { _id: id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true, returnDocument: "after" },
  ).lean();
  const count = doc?.count ?? 1;
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterS: Math.ceil(((bucket + 1) * windowS * 1000 - now) / 1000) };
}

/** Friendly wait text for error messages. */
export const waitText = (s: number) => (s > 90 ? `${Math.ceil(s / 60)} minutes` : `${s} seconds`);

/**
 * Rejects cross-site POSTs to route handlers (CSRF). Browsers send Origin on
 * form posts and fetches; it must match the host the request was made to.
 */
export function isSameOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Only plain strings reach MongoDB filters (blocks operator injection such as { "$ne": null }). */
export function str(v: unknown, max = 200): string {
  if (typeof v !== "string") throw new Error("invalid_input");
  return v.slice(0, max);
}
