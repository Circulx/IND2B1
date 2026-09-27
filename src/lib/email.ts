import "server-only";
import { env } from "./env";

/**
 * Transactional email: account verification and password reset. Uses the
 * Resend HTTP API directly (no SDK, same style as the Cloudinary calls in
 * lib/media/storage.ts). Configure RESEND_API_KEY + EMAIL_FROM to send for
 * real; without them, production throws (callers must not report success
 * when nothing was sent) and development logs the message to the console
 * instead, so you can click the link straight from the terminal.
 */
const isProd = process.env.NODE_ENV === "production";

async function send(to: string, subject: string, html: string, text: string) {
  const e = env();
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM) {
    if (isProd) throw new Error("Email is not configured: set RESEND_API_KEY and EMAIL_FROM.");
    console.info(`\n[ind2b] (dev — email not sent) to=${to}\nsubject: ${subject}\n\n${text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: e.EMAIL_FROM, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`email_send_failed:${res.status}`);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function shell(bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f7;font-family:Arial,Helvetica,sans-serif;color:#1a2226">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0f6f66;padding:20px 28px;color:#fff;font-size:18px;font-weight:700">IND2B</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.55">${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;color:#8a939b;font-size:12px">If you didn't request this, you can safely ignore this email — nothing will happen.</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#0f6f66;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;

export async function sendVerificationEmail(to: string, name: string, link: string) {
  const safeName = escapeHtml(name);
  await send(
    to,
    "Confirm your email — IND2B",
    shell(`<p>Hi ${safeName},</p><p>Confirm your email address to finish setting up your IND2B account.</p>${button(link, "Confirm email")}<p style="font-size:13px;color:#8a939b">This link expires in 24 hours.</p>`),
    `Hi ${name},\n\nConfirm your email address to finish setting up your IND2B account:\n${link}\n\nThis link expires in 24 hours.`,
  );
}

export async function sendPasswordResetEmail(to: string, name: string, link: string) {
  const safeName = escapeHtml(name);
  await send(
    to,
    "Reset your password — IND2B",
    shell(`<p>Hi ${safeName},</p><p>We received a request to reset your IND2B password.</p>${button(link, "Reset password")}<p style="font-size:13px;color:#8a939b">This link expires in 1 hour. If you didn't request this, your password is still safe.</p>`),
    `Hi ${name},\n\nReset your password:\n${link}\n\nThis link expires in 1 hour. If you didn't request this, your password is still safe.`,
  );
}
