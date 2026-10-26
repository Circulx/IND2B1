#!/usr/bin/env node
/**
 * `npm run email:test -- --to you@example.com`
 * Checks the EMAIL_* settings (login to Gmail/SMTP) and, with --to, sends one test email.
 * Reads .env.local / .env like the app does.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const provider = process.env.EMAIL_PROVIDER;
const user = process.env.EMAIL_USER;
const pass = (process.env.EMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
if (provider !== "gmail" && provider !== "smtp") { console.error('Set EMAIL_PROVIDER="gmail" (or "smtp") in .env.local'); process.exit(1); }
if (!user || !pass) { console.error("Set EMAIL_USER and EMAIL_APP_PASSWORD in .env.local"); process.exit(1); }

const { default: nodemailer } = await import("nodemailer");
const port = Number(process.env.SMTP_PORT || 587);
const transport = provider === "gmail"
  ? nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } })
  : nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user, pass } });

try {
  await transport.verify();
  console.log(`✓ Signed in to ${provider === "gmail" ? "smtp.gmail.com" : process.env.SMTP_HOST} as ${user}`);
} catch (e) {
  console.error(`✗ Login failed: ${e.message}`);
  if (provider === "gmail") console.error("  Use a Google App Password (Google Account → Security → 2-Step Verification → App passwords), not the normal password.");
  process.exit(1);
}

const i = process.argv.indexOf("--to");
const to = i > -1 ? process.argv[i + 1] : undefined;
if (to) {
  const info = await transport.sendMail({
    from: { name: process.env.EMAIL_FROM_NAME || "IND2B", address: user }, to,
    subject: "IND2B email test", text: "Email sending works. Sign-up codes and password resets will be delivered from this address.",
  });
  console.log(`✓ Test email sent to ${to} (${info.messageId})`);
} else {
  console.log("Add --to you@example.com to send a test email.");
}
transport.close();
