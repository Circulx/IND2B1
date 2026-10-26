import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";

/**
 * Outgoing email. One SMTP connection pool per server process.
 *
 *   EMAIL_PROVIDER="gmail"                    Gmail or Google Workspace (smtp.gmail.com:465, TLS)
 *   EMAIL_USER="noreply@yourdomain.com"       the mailbox that sends (must be the Google account or a verified alias)
 *   EMAIL_APP_PASSWORD="abcd efgh ijkl mnop"  a Google App Password (Google Account → Security → App passwords), NOT the normal password
 *   EMAIL_FROM_NAME="IND2B"                   optional display name
 *
 * Development without EMAIL_PROVIDER prints emails (with the code) in the server log.
 */

export class EmailError extends Error {}

export type Mail = { to: string; subject: string; html: string; text: string; fromName?: string; replyTo?: string };

type Cache = { transport?: Transporter; key?: string };
const g = globalThis as unknown as { __ind2bMail?: Cache };
const cache: Cache = (g.__ind2bMail ??= {});

function provider() {
  const e = env();
  if (e.EMAIL_PROVIDER) return e.EMAIL_PROVIDER;
  return process.env.NODE_ENV === "production" ? null : "console";
}

/** True when emails will really be delivered (not just printed in the log). */
export const emailDelivers = () => {
  const p = provider();
  return p === "gmail" || p === "smtp";
};

function transport(): Transporter {
  const e = env();
  const p = provider();
  const pass = (e.EMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");      // Google shows app passwords in groups of four
  const key = `${p}|${e.EMAIL_USER}|${e.SMTP_HOST}|${e.SMTP_PORT}|${pass.length}`;
  if (cache.transport && cache.key === key) return cache.transport;
  const timeouts = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };
  cache.transport = p === "gmail"
    ? nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, pool: true, maxConnections: 3, auth: { user: e.EMAIL_USER!, pass }, ...timeouts })
    : nodemailer.createTransport({
      host: e.SMTP_HOST!, port: e.SMTP_PORT ?? 587, secure: (e.SMTP_PORT ?? 587) === 465, pool: true, maxConnections: 3,
      ...(e.EMAIL_USER && pass ? { auth: { user: e.EMAIL_USER, pass } } : {}), ...timeouts,
    });
  cache.key = key;
  return cache.transport;
}

/** Sends one email. Throws EmailError with a log-friendly reason when it cannot be sent. */
export async function sendEmail(mail: Mail) {
  const e = env();
  const p = provider();
  if (!p) {
    console.error("[email] EMAIL_PROVIDER is not configured; cannot send:", mail.subject);
    throw new EmailError("not_configured");
  }
  if (p === "console") {
    console.info(`\n[email:console] ─────────────────────────────────────────\n  To:      ${mail.to}\n  Subject: ${mail.subject}\n${mail.text.split("\n").map((l) => `  ${l}`).join("\n")}\n[email:console] ─────────────────────────────────────────\n`);
    return { id: "console" };
  }
  const fromName = (mail.fromName ?? e.EMAIL_FROM_NAME).replace(/["<>\r\n]/g, "").slice(0, 60);
  try {
    const info = await transport().sendMail({
      from: { name: fromName, address: e.EMAIL_USER! },
      to: mail.to,
      subject: mail.subject.replace(/[\r\n]+/g, " "),
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ?? e.EMAIL_REPLY_TO ? { replyTo: mail.replyTo ?? e.EMAIL_REPLY_TO } : {}),
      headers: { "X-Auto-Response-Suppress": "All", "Auto-Submitted": "auto-generated" },
    });
    return { id: String(info.messageId ?? "") };
  } catch (err) {
    const code = (err as { code?: string; responseCode?: number }).code ?? "";
    // EAUTH = wrong EMAIL_USER / EMAIL_APP_PASSWORD (or 2-step verification / app password not set up).
    console.error(`[email] send failed (${code || "error"}): ${(err as Error).message?.slice(0, 300)}`);
    throw new EmailError(code === "EAUTH" ? "auth_failed" : "send_failed");
  }
}

/** Checks the SMTP login without sending anything (used by `npm run email:test`). */
export async function verifyEmailTransport() {
  if (!emailDelivers()) return { ok: false as const, reason: "EMAIL_PROVIDER is not gmail/smtp" };
  try {
    await transport().verify();
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, reason: (err as Error).message };
  }
}
