import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, bearerToken, verifySession } from "@/lib/auth/session";

/**
 * Runs before every page and API request.
 *
 * 1. Storefront hostnames → /store/[store]
 *      priyahandlooms.ind2b.com/products/x   → /store/priyahandlooms/products/x
 *      priyahandlooms.localhost:3000/...     → same, for local development
 *      www.priyahandlooms.in/...             → /store/_d/... (store looked up by verified custom domain)
 *
 * 2. Access control (checked again in every layout, Server Action and route handler):
 *      /dashboard, /start, /api/uploads           → signed-in store owner
 *      /api/kyc                                   → store owner (own files) or IND2B staff
 *      /admin                                     → IND2B staff: admin or super admin
 *      /superadmin                                → super admin control centre: super admins only
 *      /superadmin/login, /superadmin/forgot-password,
 *      /superadmin/logout                         → public (super admin sign-in, reset and sign-out)
 *      /admin/login, /admin/forgot-password,
 *      /forgot-password, /api/auth/token          → public (sign-in and password reset)
 *    The token is the session cookie or, for /api/*, an `Authorization: Bearer <jwt>` header.
 *
 * 3. Security headers on every response, including a per-request nonce-based
 *    Content-Security-Policy (blocks injected scripts even if HTML were injected).
 */
const isProd = process.env.NODE_ENV === "production";
const ROOT = (process.env.ROOT_DOMAIN || "ind2b.com").toLowerCase();
const APP_HOSTS = new Set([ROOT, `www.${ROOT}`, "localhost", "127.0.0.1", ...(process.env.APP_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)]);
const RESERVED = new Set(["www", "api", "admin", "dashboard", "app", "auth", "cdn", "img", "mail", "static"]);
const IMG_HOSTS = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_URL ? " https://res.cloudinary.com" : "";

function csp(nonce: string, https: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",            // theme colours are applied as inline CSS variables
    `img-src 'self' data: blob:${IMG_HOSTS}`,
    "font-src 'self' data:",
    `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function secure(res: NextResponse, policy: string, https = false) {
  res.headers.set("Content-Security-Policy", policy);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (https) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return res;
}

export async function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0]!.toLowerCase();
  const { pathname, search } = req.nextUrl;

  const https = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce, isProd && https);
  // Never trust these from the browser; only this proxy sets them.
  const headers = new Headers(req.headers);
  headers.delete("x-ind2b-base");
  headers.delete("x-ind2b-domain");
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);   // Next.js reads the nonce from here and adds it to its scripts

  /* ---------------- 1. storefront hosts */
  if (!APP_HOSTS.has(host)) {
    let slug: string | null = null;
    for (const root of new Set([ROOT, "localhost"])) {
      if (host.endsWith(`.${root}`)) {
        const sub = host.slice(0, -(root.length + 1));
        if (sub && !sub.includes(".") && !RESERVED.has(sub)) slug = sub;
      }
    }
    // Platform-only areas are never served on a store's hostname.
    if (/^\/(dashboard|admin|superadmin|start|login|signup|logout|forgot-password|store)(\/|$)/.test(pathname) || /^\/api\/(uploads|kyc|auth)(\/|$)/.test(pathname)) {
      return secure(new NextResponse("Not found", { status: 404 }), policy, isProd && https);
    }
    // Uploaded images (local storage) are served from the same path on every host.
    if (pathname.startsWith("/media/")) return secure(NextResponse.next({ request: { headers } }), policy, isProd && https);
    const url = req.nextUrl.clone();
    headers.set("x-ind2b-base", "");
    if (slug) {
      url.pathname = `/store/${slug}${pathname === "/" ? "" : pathname}`;
    } else {
      url.pathname = `/store/_d${pathname === "/" ? "" : pathname}`;
      headers.set("x-ind2b-domain", host);
    }
    return secure(NextResponse.rewrite(url, { request: { headers } }), policy, isProd && https);
  }

  /* ---------------- 2. access control on the platform host */
  const area = /^\/admin\/(login|forgot-password)\/?$/.test(pathname) ? null
    : /^\/superadmin\/(login|forgot-password|logout)\/?$/.test(pathname) ? null
    : /^\/superadmin(\/|$)/.test(pathname) ? "super"
    : /^\/admin(\/|$)/.test(pathname) ? "staff"
    : /^\/(dashboard|start)(\/|$)/.test(pathname) ? "merchant"
    : /^\/api\/uploads(\/|$)/.test(pathname) ? "merchant"
    : /^\/api\/kyc(\/|$)/.test(pathname) ? "any"
    : null;
  if (area) {
    const isApi = pathname.startsWith("/api/");
    const session = (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) ?? (isApi ? await verifySession(bearerToken(req.headers)) : null);
    const allowed = session && (
      area === "any" ||
      (area === "staff" && (session.role === "admin" || session.role === "superadmin")) ||
      (area === "super" && session.role === "superadmin") ||
      (area === "merchant" && session.role === "merchant")
    );
    if (!allowed) {
      if (isApi) return secure(NextResponse.json({ error: "unauthorized" }, { status: 401 }), policy, isProd && https);
      const login = area === "super" ? "/superadmin/login" : area === "staff" ? "/admin/login" : pathname.startsWith("/start") && !session ? "/signup" : "/login";
      const url = new URL(login, req.url);
      url.searchParams.set("next", pathname + search);
      return secure(NextResponse.redirect(url), policy, isProd && https);
    }
  }
  return secure(NextResponse.next({ request: { headers } }), policy, isProd && https);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
