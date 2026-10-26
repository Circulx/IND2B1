"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { resendSignupCode, signUp, verifySignup, type SignupState } from "@/actions/auth";
import { PLATFORM_ACCENT, PasswordInput, Steps, VerifyEmailStep, accentVars } from "@/components/auth/otp";

/**
 * Store-owner sign-up in two steps:
 *   1. details (name, email, mobile, password)  →  a 6-digit code is emailed
 *   2. enter the code                            →  the account is created and the owner is signed in
 */
export function SignupForm({ store, template }: { store?: string; template?: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signUp, {});
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [state]);          // a new answer from the server leaves "edit" mode
  const e = state.errors ?? {};
  const verifying = state.step === "verify" && !!state.email && !editing;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-6" style={accentVars(PLATFORM_ACCENT)}>
      <Steps steps={["Your details", "Verify email"]} current={verifying ? 1 : 0} />
      {verifying ? (
        <VerifyEmailStep
          key={`${state.email}:${state.resendInS}`}
          email={state.email!} masked={state.masked ?? state.email!} notice={state.notice} resendInS={state.resendInS}
          verify={verifySignup} resend={() => resendSignupCode(state.email!)} onChangeEmail={() => setEditing(true)} />
      ) : (
        <form action={action} className="flex flex-col gap-4" noValidate>
          <div><h2 className="text-[28px]">Create your account</h2><p className="mt-1.5 text-muted">We&apos;ll email you a code to verify your address. Next, you&apos;ll name your store and pick a template.</p></div>
          <input type="hidden" name="store" value={store ?? ""} /><input type="hidden" name="template" value={template ?? ""} />
          <Field label="Your name" htmlFor="name" error={e.name}><Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name} /></Field>
          <Field label="Email" htmlFor="email" error={e.email}><Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} /></Field>
          <Field label="Mobile number" htmlFor="phone" error={e.phone} hint="We send order alerts here."><Input id="phone" name="phone" type="tel" mono autoComplete="tel" defaultValue={state.values?.phone} /></Field>
          <PasswordInput id="password" label="Password" error={e.password} hint="At least 8 characters with letters and a number." />
          <label className="flex items-start gap-2.5 text-[13px]"><input type="checkbox" name="consent" className="mt-0.5" defaultChecked={state.values?.consent === "on"} /> I agree to the Terms and Privacy notice.</label>
          {e.consent && <span className="text-xs text-bad">{e.consent}</span>}
          {state.error && <p role="alert" className="rounded-control bg-bad-50 p-3 text-sm text-bad">{state.error}</p>}
          <Button type="submit" size="lg" disabled={pending}>{pending ? "Sending code…" : "Continue"}</Button>
          <p className="text-center text-sm">Already have an account? <Link href="/login" className="font-semibold text-teal-700">Log in</Link></p>
        </form>
      )}
    </div>
  );
}
