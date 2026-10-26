import "server-only";
import { EmailError, sendEmail } from "./index";
import { otpEmail, passwordChangedEmail, welcomeEmail, type Brand, type OtpPurpose } from "./templates";
import { OTP_TTL_MIN } from "../services/otp";

/** Message shown to the user when an email could not be sent. */
export const EMAIL_FAILED = "We couldn't send the email right now. Please try again in a minute.";

/** Sends a code email. Returns false (after logging) when it could not be sent. */
export async function sendOtpEmail(opts: { brand: Brand; purpose: OtpPurpose; to: string; code: string; name?: string; ip?: string }) {
  const mail = otpEmail({ brand: opts.brand, purpose: opts.purpose, code: opts.code, name: opts.name, minutes: OTP_TTL_MIN, requestedFrom: opts.ip && opts.ip !== "unknown" ? opts.ip : undefined });
  try {
    await sendEmail({ to: opts.to, fromName: opts.brand.name, ...mail });
    return true;
  } catch (e) {
    if (!(e instanceof EmailError)) console.error("[email]", e);
    return false;
  }
}

/** Fire-and-forget notices: a failure is logged but never blocks the user. */
export function notifyPasswordChanged(opts: { brand: Brand; to: string; name?: string; ip?: string; signInUrl: string }) {
  const mail = passwordChangedEmail({ brand: opts.brand, name: opts.name, when: new Date(), ip: opts.ip, signInUrl: opts.signInUrl });
  void sendEmail({ to: opts.to, fromName: opts.brand.name, ...mail }).catch(() => {});
}

export function notifyWelcome(opts: { brand: Brand; to: string; name: string; ctaLabel: string; ctaUrl: string; lines: string[] }) {
  const mail = welcomeEmail(opts);
  void sendEmail({ to: opts.to, fromName: opts.brand.name, ...mail }).catch(() => {});
}
