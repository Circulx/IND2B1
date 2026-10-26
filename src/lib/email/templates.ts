import "server-only";

/**
 * Transactional email templates. Table-based layout with inline styles so they
 * render the same in Gmail, Outlook, Apple Mail and phone mail apps. Every
 * template has a plain-text part too.
 *
 * Platform emails use the IND2B brand; shopper emails use the store's own name
 * and theme colours, so they look like they come from the shop.
 */

export type Brand = {
  name: string;              // shown in the header and as the sender name
  primary: string;           // header band, code highlight
  onPrimary: string;         // text on the header band
  accent: string;            // thin accent line
  logoUrl?: string;          // absolute https URL only
  footer: string;            // one line under the card
  siteUrl?: string;          // link in the footer
};

export const PLATFORM_BRAND: Brand = {
  name: "IND2B", primary: "#0B5F5C", onPrimary: "#FFFFFF", accent: "#E07B22",
  footer: "IND2B · Online stores for Indian businesses",
};

export type Rendered = { subject: string; html: string; text: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const hex = (c: string, d: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : d);
const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif";
const mono = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono','Courier New',monospace";

/** Outer frame shared by every email. `preheader` is the grey preview line in the inbox list. */
function frame(brand: Brand, preheader: string, body: string) {
  const primary = hex(brand.primary, PLATFORM_BRAND.primary);
  const onPrimary = hex(brand.onPrimary, "#FFFFFF");
  const accent = hex(brand.accent, PLATFORM_BRAND.accent);
  const logo = brand.logoUrl && /^https:\/\//.test(brand.logoUrl)
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" height="36" style="display:block;height:36px;max-width:180px;border:0;outline:none">`
    : `<span style="font-family:${font};font-size:20px;font-weight:800;letter-spacing:-0.3px;color:${onPrimary}">${esc(brand.name)}</span>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(brand.name)}</title></head>
<body style="margin:0;padding:0;background:#F4F5F2;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F5F2">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
    <tr><td style="background:${primary};border-radius:12px 12px 0 0;padding:22px 32px">${logo}</td></tr>
    <tr><td style="height:4px;line-height:4px;font-size:0;background:${accent}">&nbsp;</td></tr>
    <tr><td style="background:#FFFFFF;border-radius:0 0 12px 12px;padding:36px 32px 32px;border:1px solid #DDE1DA;border-top:0">${body}</td></tr>
    <tr><td style="padding:20px 8px 0;text-align:center;font-family:${font};font-size:12px;line-height:18px;color:#7A838C">
      ${esc(brand.footer)}${brand.siteUrl ? ` · <a href="${esc(brand.siteUrl)}" style="color:#56616C;text-decoration:underline">${esc(brand.siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, ""))}</a>` : ""}<br>
      This is an automated message. Please do not reply.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const h1 = (t: string) => `<h1 style="margin:0 0 12px;font-family:${font};font-size:22px;line-height:30px;font-weight:700;color:#16202A">${t}</h1>`;
const p = (t: string, extra = "") => `<p style="margin:0 0 16px;font-family:${font};font-size:15px;line-height:24px;color:#2B3640;${extra}">${t}</p>`;
const small = (t: string) => `<p style="margin:0;font-family:${font};font-size:13px;line-height:20px;color:#56616C">${t}</p>`;
const rule = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #EAEDE7;height:1px;line-height:1px;font-size:0;padding:0">&nbsp;</td></tr></table>`;
const button = (label: string, href: string, brand: Brand) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px"><tr><td style="border-radius:8px;background:${hex(brand.primary, PLATFORM_BRAND.primary)}">
    <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-family:${font};font-size:15px;font-weight:600;color:${hex(brand.onPrimary, "#FFFFFF")};text-decoration:none;border-radius:8px">${esc(label)}</a></td></tr></table>`;

/** The six digits, each in its own box (large, easy to read on a phone). */
function codeBlock(code: string, brand: Brand) {
  const primary = hex(brand.primary, PLATFORM_BRAND.primary);
  const cells = code.split("").map((d) =>
    `<td style="padding:0 4px"><div style="width:44px;height:56px;line-height:56px;text-align:center;border:1.5px solid ${primary};border-radius:10px;background:#F7F8F5;font-family:${mono};font-size:28px;font-weight:700;color:#16202A">${esc(d)}</div></td>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 10px"><tr>${cells}</tr></table>
  <p style="margin:0 0 24px;text-align:center;font-family:${mono};font-size:13px;letter-spacing:4px;color:#7A838C">${esc(code)}</p>`;
}

export type OtpPurpose = "signup" | "reset";

const PURPOSE: Record<OtpPurpose, { title: string; lead: (b: Brand) => string; subject: (b: Brand) => string }> = {
  signup: {
    title: "Verify your email",
    lead: (b) => `Use this code to verify your email address and finish creating your ${esc(b.name)} account.`,
    subject: (b) => `verification code for ${b.name}`,
  },
  reset: {
    title: "Reset your password",
    lead: (b) => `We received a request to reset the password of your ${esc(b.name)} account. Enter this code to choose a new password.`,
    subject: (b) => `password reset code for ${b.name}`,
  },
};

/** One-time code email (sign-up verification or password reset). */
export function otpEmail(opts: { brand: Brand; purpose: OtpPurpose; code: string; name?: string; minutes: number; requestedFrom?: string }): Rendered {
  const { brand, purpose, code, minutes } = opts;
  const k = PURPOSE[purpose];
  const hello = opts.name ? `Hi ${esc(opts.name.split(" ")[0]!)},` : "Hi,";
  const body = [
    h1(k.title),
    p(hello),
    p(k.lead(brand)),
    codeBlock(code, brand),
    p(`This code expires in <b>${minutes} minutes</b> and can be used once. Never share it with anyone — ${esc(brand.name)} staff will never ask for it.`, "font-size:14px;color:#56616C"),
    rule,
    `<div style="height:16px;line-height:16px;font-size:0">&nbsp;</div>`,
    small(purpose === "reset"
      ? `Didn't ask to reset your password? You can ignore this email — your password stays the same.${opts.requestedFrom ? ` Request made from ${esc(opts.requestedFrom)}.` : ""}`
      : `Didn't try to create an account? You can safely ignore this email.`),
  ].join("");
  const text = [
    k.title, "", opts.name ? `Hi ${opts.name.split(" ")[0]},` : "Hi,", "",
    k.lead(brand).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&"), "",
    `Your code: ${code}`, "",
    `It expires in ${minutes} minutes and can be used once. Never share it with anyone.`, "",
    purpose === "reset" ? "Didn't ask to reset your password? Ignore this email; your password stays the same." : "Didn't try to create an account? Ignore this email.",
    "", "—", brand.footer,
  ].join("\n");
  return { subject: `${code} is your ${k.subject(brand)}`, html: frame(brand, `Your code is ${code}. It expires in ${minutes} minutes.`, body), text };
}

/** Sent after a password was reset, so the owner notices if it wasn't them. */
export function passwordChangedEmail(opts: { brand: Brand; name?: string; when: Date; ip?: string; signInUrl: string }): Rendered {
  const { brand } = opts;
  const when = opts.when.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) + " IST";
  const body = [
    h1("Your password was changed"),
    p(opts.name ? `Hi ${esc(opts.name.split(" ")[0]!)},` : "Hi,"),
    p(`The password of your ${esc(brand.name)} account was reset on <b>${esc(when)}</b>${opts.ip && opts.ip !== "unknown" ? ` from <b>${esc(opts.ip)}</b>` : ""}. For your security, every device was signed out.`),
    button("Sign in", opts.signInUrl, brand),
    rule,
    `<div style="height:16px;line-height:16px;font-size:0">&nbsp;</div>`,
    small(`<b style="color:#9B1C14">Wasn't you?</b> Reset your password again right away using “Forgot password” on the sign-in page, and contact ${esc(brand.name)} support.`),
  ].join("");
  const text = [
    "Your password was changed", "",
    `The password of your ${brand.name} account was reset on ${when}${opts.ip && opts.ip !== "unknown" ? ` from ${opts.ip}` : ""}. Every device was signed out.`, "",
    `Sign in: ${opts.signInUrl}`, "",
    "Wasn't you? Reset your password again right away using \"Forgot password\" and contact support.", "", "—", brand.footer,
  ].join("\n");
  return { subject: `Your ${brand.name} password was changed`, html: frame(brand, "Your password was reset and every device was signed out.", body), text };
}

/** Sent once the email is verified and the account exists. */
export function welcomeEmail(opts: { brand: Brand; name: string; ctaLabel: string; ctaUrl: string; lines: string[] }): Rendered {
  const { brand } = opts;
  const body = [
    h1(`Welcome to ${esc(brand.name)}, ${esc(opts.name.split(" ")[0]!)}!`),
    p("Your email is verified and your account is ready."),
    ...opts.lines.map((l) => p(esc(l))),
    button(opts.ctaLabel, opts.ctaUrl, brand),
    small("You received this because an account was created with this email address."),
  ].join("");
  const text = [`Welcome to ${brand.name}, ${opts.name.split(" ")[0]}!`, "", "Your email is verified and your account is ready.", "", ...opts.lines, "", `${opts.ctaLabel}: ${opts.ctaUrl}`, "", "—", brand.footer].join("\n");
  return { subject: `Welcome to ${brand.name}`, html: frame(brand, "Your email is verified and your account is ready.", body), text };
}
