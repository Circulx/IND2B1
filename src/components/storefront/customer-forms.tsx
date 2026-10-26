"use client";

import { useActionState, useEffect, useRef, useState, type ComponentProps } from "react";
import type { CustomerAuthState, CustomerOtpState, CustomerSignupState } from "@/actions/customer-auth";
import { PasswordInput, STORE_ACCENT, Steps, VerifyEmailStep, accentVars } from "@/components/auth/otp";

/** Shopper account forms. Styled only with the store's --store-* theme variables. */

type Action = (prev: CustomerAuthState, fd: FormData) => Promise<CustomerAuthState>;
const btn = { background: "var(--store-primary)", color: "var(--store-on-primary)", borderRadius: "var(--store-radius)" };
const inputCls = "h-12 w-full rounded-control border border-control bg-white px-3 focus:border-[var(--store-primary)] focus:outline-none";

function Input({ id, label, error, hint, ...rest }: { id: string; label: string; error?: string; hint?: string } & ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input id={id} name={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-msg` : undefined} className={inputCls} {...rest} />
      {error ? <span id={`${id}-msg`} className="text-xs text-bad">{error}</span> : hint ? <span id={`${id}-msg`} className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function CustomerLoginForm({ action, next, registerHref, forgotHref, notice, demo }: { action: Action; next?: string; registerHref: string; forgotHref?: string; notice?: string; demo?: { email: string; password: string } }) {
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(action, {});
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {notice && <p role="status" className="rounded-card bg-ok-50 p-3 text-sm text-ok">{notice}</p>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Input ref={email} id="email" label="Email" type="email" autoComplete="email" defaultValue={state.values?.email} required />
      <Input ref={password} id="password" label="Password" type="password" autoComplete="current-password" required />
      {forgotHref && <a href={forgotHref} className="-mt-1 self-end text-sm font-semibold" style={{ color: "var(--store-primary)" }}>Forgot password?</a>}
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-12 font-semibold disabled:opacity-60" style={btn}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="text-center text-sm">New here? <a href={registerHref} className="font-semibold" style={{ color: "var(--store-primary)" }}>Create an account</a></p>
      {demo && (
        <button type="button" onClick={() => { if (email.current && password.current) { email.current.value = demo.email; password.current.value = demo.password; } }}
          className="rounded-control border border-dashed border-control p-2.5 text-left text-xs text-muted">
          Demo shopper (development): <span className="font-mono">{demo.email} · {demo.password}</span>
        </button>
      )}
    </form>
  );
}

/**
 * Shopper registration in two steps: details, then the 6-digit code emailed to them.
 * The account only exists once the email is verified.
 */
export function CustomerRegisterForm({ action, verify, resend, next, loginHref }: {
  action: (prev: CustomerSignupState, fd: FormData) => Promise<CustomerSignupState>;
  verify: (prev: CustomerOtpState, fd: FormData) => Promise<CustomerOtpState>;
  resend: (email: string) => Promise<CustomerOtpState>;
  next?: string; loginHref: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerSignupState, FormData>(action, {});
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [state]);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const verifying = state.step === "verify" && !!state.email && !editing;
  return (
    <div className="flex flex-col gap-6" style={accentVars(STORE_ACCENT)}>
      <Steps steps={["Your details", "Verify email"]} current={verifying ? 1 : 0} />
      {verifying ? (
        <VerifyEmailStep key={`${state.email}:${state.resendInS}`} email={state.email!} masked={state.masked ?? state.email!} notice={state.notice} resendInS={state.resendInS}
          verify={verify} resend={() => resend(state.email!)} onChangeEmail={() => setEditing(true)} />
      ) : (
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="next" value={next ?? ""} />
          <Input id="name" label="Full name" autoComplete="name" defaultValue={v.name} error={e.name} required />
          <Input id="email" label="Email" type="email" autoComplete="email" defaultValue={v.email} error={e.email} required />
          <Input id="phone" label="Mobile number (optional)" type="tel" autoComplete="tel" defaultValue={v.phone} error={e.phone} />
          <PasswordInput id="password" label="Password" error={e.password} hint="At least 8 characters with letters and a number." inputClassName="h-12" />
          <PasswordInput id="confirm" label="Repeat password" error={e.confirm} meter={false} inputClassName="h-12" />
          {state.error && <p role="alert" className="rounded-card bg-bad-50 p-3 text-sm text-bad">{state.error}</p>}
          <button type="submit" disabled={pending} className="h-12 font-semibold disabled:opacity-60" style={btn}>{pending ? "Sending code…" : "Continue"}</button>
          <p className="text-center text-xs text-muted">We&apos;ll email you a 6-digit code to verify your address.</p>
          <p className="text-center text-sm">Already have an account? <a href={loginHref} className="font-semibold" style={{ color: "var(--store-primary)" }}>Sign in</a></p>
        </form>
      )}
    </div>
  );
}

export function CustomerProfileForm({ action, name, phone }: { action: Action; name: string; phone: string }) {
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(action, {});
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Your details</h2>
      <Input id="name" label="Full name" defaultValue={name} error={e.name} autoComplete="name" required />
      <Input id="phone" label="Mobile number" type="tel" defaultValue={phone} error={e.phone} autoComplete="tel" />
      {state.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
      <button type="submit" disabled={pending} className="h-11 self-start px-6 font-semibold disabled:opacity-60" style={btn}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

export function CustomerPasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<CustomerAuthState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  const e = state.errors ?? {};
  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Change password</h2>
      <Input id="current" label="Current password" type="password" autoComplete="current-password" error={e.current} required />
      <Input id="next" label="New password" type="password" autoComplete="new-password" error={e.next} required />
      <Input id="confirm" label="Repeat new password" type="password" autoComplete="new-password" error={e.confirm} required />
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
      <button type="submit" disabled={pending} className="h-11 self-start px-6 font-semibold disabled:opacity-60" style={btn}>{pending ? "Changing…" : "Change password"}</button>
    </form>
  );
}
