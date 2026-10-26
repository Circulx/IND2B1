"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Shared pieces of the e-mail code screens (sign-up verification and password reset).
 * They take their colour from the CSS variable --auth-accent, so the same components
 * follow the IND2B theme on platform pages and each store's theme on storefronts.
 */

export type Accent = { accent: string; onAccent: string; radius?: string; font?: string };
export const PLATFORM_ACCENT: Accent = { accent: "#0B5F5C", onAccent: "#FFFFFF", radius: "6px" };
export const STORE_ACCENT: Accent = { accent: "var(--store-primary)", onAccent: "var(--store-on-primary)", radius: "var(--store-radius)", font: "var(--store-font)" };

export const accentVars = (a: Accent): CSSProperties => ({
  ["--auth-accent" as string]: a.accent, ["--auth-on-accent" as string]: a.onAccent, ["--auth-radius" as string]: a.radius ?? "6px",
  ["--auth-font" as string]: a.font ?? "var(--font-display)",
});
export const primaryButton: CSSProperties = { background: "var(--auth-accent)", color: "var(--auth-on-accent)", borderRadius: "var(--auth-radius)" };

/* ------------------------------------------------------------------ step indicator */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current, on = i === current;
        return (
          <li key={s} className="flex items-center gap-2" aria-current={on ? "step" : undefined}>
            <span className={cn("flex size-6 items-center justify-center rounded-full border text-[11px]", !done && !on && "border-control text-muted")}
              style={done || on ? { background: "var(--auth-accent)", borderColor: "var(--auth-accent)", color: "var(--auth-on-accent)" } : undefined}>
              {done ? <Icon name="check" size={13} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={on ? "text-ink" : "text-muted"}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ the 6 boxes */
/**
 * Six one-digit boxes that behave like one field: typing moves forward, Backspace moves back,
 * pasting "123456" (or "123 456") fills all boxes, and the phone keyboard offers the code
 * from the SMS/email bar (autocomplete="one-time-code"). The value is posted as `name`.
 * When all six digits are entered the surrounding form is submitted automatically.
 */
export function OtpInput({ name = "code", length = 6, error, disabled, autoSubmit = true, resetKey }: { name?: string; length?: number; error?: string; disabled?: boolean; autoSubmit?: boolean; resetKey?: unknown }) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const submitted = useRef("");

  // A new code was requested or the code was wrong: clear the boxes and focus the first one.
  useEffect(() => { setDigits(Array(length).fill("")); submitted.current = ""; refs.current[0]?.focus(); }, [resetKey, length]);

  const value = digits.join("");
  useEffect(() => {
    if (autoSubmit && value.length === length && /^\d+$/.test(value) && submitted.current !== value) {
      submitted.current = value;
      refs.current[0]?.form?.requestSubmit();
    }
  }, [value, length, autoSubmit]);

  const fill = (start: number, text: string) => {
    const clean = text.replace(/\D/g, "").slice(0, length - start);
    if (!clean) return;
    setDigits((d) => { const n = [...d]; clean.split("").forEach((c, i) => { n[start + i] = c; }); return n; });
    refs.current[Math.min(start + clean.length, length - 1)]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex justify-between gap-2 sm:gap-2.5" role="group" aria-label="6-digit code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={!!error}
            maxLength={length}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (v.length > 1) return fill(i, v);                 // autofill / paste into one box
              setDigits((x) => { const n = [...x]; n[i] = v; return n; });
              if (v && i < length - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) { refs.current[i - 1]?.focus(); setDigits((x) => { const n = [...x]; n[i - 1] = ""; return n; }); e.preventDefault(); }
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
            }}
            onPaste={(e) => { e.preventDefault(); fill(i, e.clipboardData.getData("text")); }}
            onFocus={(e) => e.target.select()}
            className={cn(
              "h-14 w-full min-w-0 max-w-14 border-[1.5px] bg-white text-center font-mono text-2xl font-semibold text-ink outline-none transition-[border-color,box-shadow] sm:h-16",
              "focus:border-[var(--auth-accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--auth-accent)_18%,transparent)]",
              error ? "border-bad" : d ? "border-[var(--auth-accent)]" : "border-control",
            )}
            style={{ borderRadius: "var(--auth-radius)" }}
          />
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ resend with countdown */
export type ResendResult = { error?: string; notice?: string; resendInS?: number };

export function ResendCode({ initialSeconds = 60, onResend, onSent }: { initialSeconds?: number; onResend: () => Promise<ResendResult>; onSent?: () => void }) {
  const [left, setLeft] = useState(initialSeconds);
  const [msg, setMsg] = useState<ResendResult | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <p className="text-muted">
        Didn&apos;t get it?{" "}
        {left > 0
          ? <span>Resend in <span className="font-mono tabular text-ink">0:{String(left).padStart(2, "0")}</span></span>
          : <button type="button" disabled={pending} className="font-semibold underline-offset-2 hover:underline disabled:opacity-60" style={{ color: "var(--auth-accent)" }}
              onClick={() => start(async () => { const r = await onResend(); setMsg(r); setLeft(r.resendInS ?? (r.error ? 0 : 60)); if (!r.error) onSent?.(); })}>
              {pending ? "Sending…" : "Send a new code"}
            </button>}
      </p>
      {msg?.notice && <p role="status" className="text-ok">{msg.notice}</p>}
      {msg?.error && <p role="alert" className="text-bad">{msg.error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ "check your email" header */
export function MailBadge({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="flex size-12 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--auth-accent) 12%, white)", color: "var(--auth-accent)" }}>
        <Icon name="inbox" size={22} />
      </span>
      <h2 className="text-[26px] leading-tight" style={{ fontFamily: "var(--auth-font)" }}>{title}</h2>
      <div className="text-[15px] text-muted">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ sign-up verification step */
type OtpAction = (prev: ResendResult, fd: FormData) => Promise<ResendResult>;

/** Step 2 of a sign-up: enter the code; resend; or go back to change the email. */
export function VerifyEmailStep({ email, masked, notice, resendInS, verify, resend, onChangeEmail, buttonLabel = "Verify and create account" }: {
  email: string; masked: string; notice?: string; resendInS?: number; verify: OtpAction; resend: () => Promise<ResendResult>; onChangeEmail: () => void; buttonLabel?: string;
}) {
  const [state, action, pending] = useActionState<ResendResult, FormData>(verify, {});
  const [round, setRound] = useState(0);
  // Clear the boxes after a wrong code so the next attempt starts fresh.
  useEffect(() => { if (state.error) setRound((r) => r + 1); }, [state]);
  return (
    <div className="flex flex-col gap-6">
      <MailBadge title="Check your email">
        We sent a 6-digit code to <b className="text-ink">{masked}</b>. Enter it below to verify your email{" "}
        <button type="button" onClick={onChangeEmail} className="font-semibold underline-offset-2 hover:underline" style={{ color: "var(--auth-accent)" }}>Change email</button>
      </MailBadge>
      {notice && <p role="status" className="rounded-control bg-info-50 p-3 text-sm text-info">{notice}</p>}
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="email" value={email} />
        <OtpInput error={state.error} disabled={pending} resetKey={round} />
        <button type="submit" disabled={pending} className="h-12 font-semibold disabled:opacity-60" style={primaryButton}>{pending ? "Verifying…" : buttonLabel}</button>
      </form>
      <ResendCode initialSeconds={resendInS ?? 60} onResend={resend} onSent={() => setRound((r) => r + 1)} />
      <p className="flex items-start gap-2 text-xs text-muted"><Icon name="lock" size={14} className="mt-0.5 shrink-0" /> The code expires in 10 minutes. Your account is only created after your email is verified.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ password with show/hide and strength */
function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const LEVELS = [["Too short", "#9B1C14"], ["Weak", "#9B1C14"], ["Fair", "#7F4500"], ["Good", "#1A5E37"], ["Strong", "#1A5E37"]] as const;

export function PasswordInput({ id, name = id, label, error, hint, autoComplete = "new-password", meter = true, inputClassName }: {
  id: string; name?: string; label: string; error?: string; hint?: string; autoComplete?: string; meter?: boolean; inputClassName?: string;
}) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  const lvl = strength(value);
  const [levelLabel, levelColor] = LEVELS[lvl] ?? LEVELS[0];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">{label}</label>
      <div className="relative">
        <input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error} aria-describedby={`${id}-msg`}
          className={cn("h-11 w-full border border-control bg-white pl-3 pr-16 text-sm text-ink focus:border-[var(--auth-accent)] focus:outline-none", inputClassName)}
          style={{ borderRadius: "var(--auth-radius)" }} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {meter && value && (
        <div className="flex items-center gap-2" aria-hidden="true">
          <div className="flex flex-1 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i < lvl ? levelColor : "#E3E6E0" }} />)}</div>
          <span className="w-16 text-right text-[11px] font-semibold" style={{ color: levelColor }}>{levelLabel}</span>
        </div>
      )}
      <span id={`${id}-msg`} className={cn("text-xs", error ? "text-bad" : "text-muted")}>{error ?? hint}</span>
    </div>
  );
}
