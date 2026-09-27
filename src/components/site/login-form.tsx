"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { Button, Field, Input } from "@/components/ui";
import { logIn, type AuthState } from "@/actions/auth";

type Demo = { email: string; password: string; label: string };

export function LoginForm({ next, demo }: { next?: string; demo: Demo[] }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(logIn, {});
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const use = (d: Demo) => { if (email.current && password.current) { email.current.value = d.email; password.current.value = d.password; } };
  return (
    <form action={action} className="flex w-full max-w-[420px] flex-col gap-5">
      <div><h2 className="text-[28px]">Log in</h2><p className="mt-1.5 text-muted">Manage your store, orders and payments.</p></div>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email"><Input ref={email} id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required /></Field>
      <Field label="Password" htmlFor="password" error={state.error}><Input ref={password} id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Logging in…" : "Log in"}</Button>
      <p className="text-center text-sm">New to IND2B? <Link href="/signup" className="font-semibold text-teal-700">Create your store</Link></p>
      {demo.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-subtle p-3.5 text-[13px]">
          <span className="font-semibold">Demo accounts (development)</span>
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
