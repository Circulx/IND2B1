"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { changePasswordAction, saveProfile, type AccountState } from "@/actions/account";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveProfile, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card className="p-5">
      <form action={action} className="flex flex-col gap-4">
        <h2 className="font-semibold">Profile</h2>
        <Field label="Your name" htmlFor="pname" error={fe.name}><Input id="pname" name="name" defaultValue={name} required /></Field>
        <Field label="Mobile number" htmlFor="pphone" error={fe.phone}><Input id="pphone" name="phone" type="tel" defaultValue={phone} /></Field>
        {state?.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
        <Button disabled={pending} className="self-start">{pending ? "Saving…" : "Save profile"}</Button>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePasswordAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card className="p-5">
      <form ref={ref} action={action} className="flex flex-col gap-4">
        <h2 className="font-semibold">Change password</h2>
        <Field label="Current password" htmlFor="cur" error={fe.current}><Input id="cur" name="current" type="password" autoComplete="current-password" required /></Field>
        <Field label="New password" htmlFor="npw" error={fe.next} hint="At least 8 characters with letters and a number."><Input id="npw" name="next" type="password" autoComplete="new-password" required /></Field>
        <Field label="Repeat new password" htmlFor="cpw" error={fe.confirm}><Input id="cpw" name="confirm" type="password" autoComplete="new-password" required /></Field>
        {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
        <Button disabled={pending} className="self-start">{pending ? "Changing…" : "Change password"}</Button>
      </form>
    </Card>
  );
}
