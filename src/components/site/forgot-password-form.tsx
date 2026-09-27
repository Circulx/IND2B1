"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { requestPasswordReset, type ForgotPasswordState } from "@/actions/auth";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        <h2 className="text-[28px]">Check your email</h2>
        <p className="text-muted">If an IND2B account exists for that address, we've sent a link to reset your password. It expires in 1 hour.</p>
        <Link href="/login" className="font-semibold text-teal-700">Back to log in</Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-[420px] flex-col gap-5">
      <div><h2 className="text-[28px]">Reset your password</h2><p className="mt-1.5 text-muted">Enter your account email and we'll send you a reset link.</p></div>
      <Field label="Email" htmlFor="email" error={state.error}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
      <p className="text-center text-sm">Remembered it? <Link href="/login" className="font-semibold text-teal-700">Log in</Link></p>
    </form>
  );
}
