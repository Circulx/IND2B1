"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { signUp, type AuthState } from "@/actions/auth";

export function SignupForm({ store, template }: { store?: string; template?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex w-full max-w-[440px] flex-col gap-4" noValidate>
      <div><h2 className="text-[28px]">Create your account</h2><p className="mt-1.5 text-muted">Next, you&apos;ll name your store and pick a template.</p></div>
      <input type="hidden" name="store" value={store ?? ""} /><input type="hidden" name="template" value={template ?? ""} />
      <Field label="Your name" htmlFor="name" error={e.name}><Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name} /></Field>
      <Field label="Email" htmlFor="email" error={e.email}><Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} /></Field>
      <Field label="Mobile number" htmlFor="phone" error={e.phone} hint="We send order alerts here."><Input id="phone" name="phone" type="tel" mono autoComplete="tel" defaultValue={state.values?.phone} /></Field>
      <Field label="Password" htmlFor="password" error={e.password} hint="At least 8 characters."><Input id="password" name="password" type="password" autoComplete="new-password" /></Field>
      <label className="flex items-start gap-2.5 text-[13px]"><input type="checkbox" name="consent" className="mt-0.5" defaultChecked={state.values?.consent === "on"} /> I agree to the Terms and Privacy notice.</label>
      {e.consent && <span className="text-xs text-bad">{e.consent}</span>}
      {state.error && <span className="text-sm text-bad">{state.error}</span>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Creating…" : "Continue"}</Button>
      <p className="text-center text-sm">Already have an account? <Link href="/login" className="font-semibold text-teal-700">Log in</Link></p>
    </form>
  );
}
