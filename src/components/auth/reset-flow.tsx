"use client";

import { useActionState, useEffect, useState, type ComponentProps } from "react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MailBadge, OtpInput, PasswordInput, ResendCode, Steps, accentVars, primaryButton, type Accent, type ResendResult } from "./otp";

/**
 * "Forgot password" in two steps, shared by merchants, staff and shoppers:
 *   1. email            → a code is sent (same answer whether or not the account exists)
 *   2. code + password  → password replaced, every device signed out, back to sign-in
 * Colours come from `accent` (IND2B theme or the store's theme).
 */

export type RequestState = { step?: "request" | "reset"; email?: string; masked?: string; resendInS?: number; notice?: string; error?: string; errors?: Record<string, string> };
export type CompleteState = { error?: string; notice?: string; resendInS?: number; errors?: Record<string, string> };

export function TextField({ id, label, error, hint, ...rest }: { id: string; label: string; error?: string; hint?: string } & ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">{label}</label>
      <input id={id} name={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-msg` : undefined} {...rest}
        className="h-11 w-full border border-control bg-white px-3 text-sm text-ink focus:border-[var(--auth-accent)] focus:outline-none"
        style={{ borderRadius: "var(--auth-radius)" }} />
      {(error || hint) && <span id={`${id}-msg`} className={cn("text-xs", error ? "text-bad" : "text-muted")}>{error ?? hint}</span>}
    </div>
  );
}

export function ResetFlow({ accent, request, complete, resend, strong, loginHref, intro, initialEmail }: {
  accent: Accent;
  request: (prev: RequestState, fd: FormData) => Promise<RequestState>;
  complete: (prev: CompleteState, fd: FormData) => Promise<CompleteState>;
  resend: (email: string) => Promise<ResendResult>;
  strong: boolean;
  loginHref: string;
  intro: string;
  initialEmail?: string;
}) {
  const [req, requestAction, requesting] = useActionState<RequestState, FormData>(request, {});
  const [done, completeAction, completing] = useActionState<CompleteState, FormData>(complete, {});
  const [editing, setEditing] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => { setEditing(false); }, [req]);
  useEffect(() => { if (done.error) setRound((r) => r + 1); }, [done]);
  const onCode = req.step === "reset" && !!req.email && !editing;
  const pwHint = strong ? "12+ characters with upper and lower case letters, a number and a symbol." : "At least 8 characters with letters and a number.";

  return (
    <div className="flex w-full flex-col gap-6" style={accentVars(accent)}>
      <Steps steps={["Find account", "New password"]} current={onCode ? 1 : 0} />
      {!onCode ? (
        <form action={requestAction} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-3">
            <span className="flex size-12 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--auth-accent) 12%, white)", color: "var(--auth-accent)" }}><Icon name="lock" size={22} /></span>
            <h2 className="text-[26px] leading-tight" style={{ fontFamily: "var(--auth-font)" }}>Forgot your password?</h2>
            <p className="text-[15px] text-muted">{intro}</p>
          </div>
          <TextField id="email" label="Email" type="email" autoComplete="email" defaultValue={req.email ?? initialEmail} error={req.errors?.email} required />
          {req.error && <p role="alert" className="rounded-control bg-bad-50 p-3 text-sm text-bad">{req.error}</p>}
          <button type="submit" disabled={requesting} className="h-12 font-semibold disabled:opacity-60" style={primaryButton}>{requesting ? "Sending code…" : "Send reset code"}</button>
          <a href={loginHref} className="text-center text-sm font-semibold" style={{ color: "var(--auth-accent)" }}>← Back to sign in</a>
        </form>
      ) : (
        <div className="flex flex-col gap-6">
          <MailBadge title="Enter the code and a new password">
            {req.notice}{" "}
            <button type="button" onClick={() => setEditing(true)} className="font-semibold underline-offset-2 hover:underline" style={{ color: "var(--auth-accent)" }}>Use a different email</button>
          </MailBadge>
          <form action={completeAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="email" value={req.email} />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">6-digit code</span>
              <OtpInput error={done.errors?.code} autoSubmit={false} resetKey={round} disabled={completing} />
            </div>
            <PasswordInput id="password" label="New password" error={done.errors?.password} hint={pwHint} />
            <PasswordInput id="confirm" label="Repeat new password" error={done.errors?.confirm} meter={false} />
            {done.error && <p role="alert" className="rounded-control bg-bad-50 p-3 text-sm text-bad">{done.error}</p>}
            <button type="submit" disabled={completing} className="h-12 font-semibold disabled:opacity-60" style={primaryButton}>{completing ? "Saving…" : "Reset password"}</button>
          </form>
          <ResendCode key={req.email} initialSeconds={req.resendInS ?? 60} onResend={() => resend(req.email!)} onSent={() => setRound((r) => r + 1)} />
          <p className="flex items-start gap-2 text-xs text-muted"><Icon name="shield" size={14} className="mt-0.5 shrink-0" /> After the reset you&apos;ll be signed out on every device and we&apos;ll email you a confirmation.</p>
        </div>
      )}
    </div>
  );
}
