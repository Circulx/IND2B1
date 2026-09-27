"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { resetPassword, type ResetPasswordState } from "@/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(resetPassword, {});
  const e = state.errors ?? {};

  if (state.done) {
    return (
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        <h2 className="text-[28px]">Password updated</h2>
        <p className="text-muted">You've been signed out everywhere for safety. Log in with your new password.</p>
        <Link href="/login" className="font-semibold text-teal-700">Go to log in</Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-[420px] flex-col gap-5" noValidate>
      <div><h2 className="text-[28px]">Choose a new password</h2></div>
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" error={e.password} hint="At least 8 characters, with letters and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={e.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
      </Field>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Reset password"}</Button>
    </form>
  );
}
