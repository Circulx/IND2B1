"use client";

import { useActionState, useRef } from "react";
import { Button, Field, Input } from "@/components/ui";
import { staffLogIn, type AuthState } from "@/actions/auth";

type Demo = { email: string; password: string; label: string };

/** IND2B staff sign-in (admins and super admins). */
export function StaffLoginForm({ next, demo, notice }: { next?: string; demo: Demo[]; notice?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(staffLogIn, {});
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const use = (d: Demo) => { if (email.current && password.current) { email.current.value = d.email; password.current.value = d.password; } };
  return (
    <form action={action} className="flex w-full flex-col gap-5">
      <div><h1 className="text-[26px]">Staff sign-in</h1><p className="mt-1.5 text-sm text-muted">For the IND2B team only. Every sign-in is recorded.</p></div>
      {notice && <p role="status" className="rounded-control bg-info-50 p-3 text-sm text-info">{notice}</p>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Work email" htmlFor="email"><Input ref={email} id="email" name="email" type="email" autoComplete="username" defaultValue={state.values?.email} required /></Field>
      <Field label="Password" htmlFor="password" error={state.error}><Input ref={password} id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      <a href="/admin/forgot-password" className="-mt-2 self-end text-sm font-semibold text-teal-700">Forgot password?</a>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      {demo.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-subtle p-3.5 text-[13px]">
          <span className="font-semibold">Demo staff accounts (development)</span>
          {demo.map((d) => (
            <button key={d.email} type="button" onClick={() => use(d)} className="flex flex-wrap items-center justify-between gap-2 rounded-control px-2 py-1.5 text-left hover:bg-teal-50">
              <span>{d.label}</span><span className="font-mono text-xs text-muted">{d.email} · {d.password}</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
