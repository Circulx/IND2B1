"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { createStaffAction, setPasswordAction, type SuperState } from "@/actions/superadmin";

/** Super admin: add an admin or another super admin. */
export function CreateStaffForm() {
  const [state, action, pending] = useActionState<SuperState, FormData>(createStaffAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  const fe = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  return (
    <Card className="h-fit p-5">
      <h2 className="mb-1 font-semibold">Add a staff member</h2>
      <p className="mb-4 text-sm text-muted">Staff sign in at /admin/login. Admins handle KYC, stores and plugins; super admins also manage users and plans.</p>
      <form ref={ref} action={action} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="st-name" error={fe.name}><Input id="st-name" name="name" defaultValue={v.name} required autoComplete="off" /></Field>
        <Field label="Work email" htmlFor="st-email" error={fe.email}><Input id="st-email" name="email" type="email" defaultValue={v.email} required autoComplete="off" /></Field>
        <Field label="Role" htmlFor="st-role"><Select key={v.role ?? "admin"} id="st-role" name="role" defaultValue={v.role ?? "admin"}><option value="admin">Admin</option><option value="superadmin">Super admin (complete control)</option></Select></Field>
        <Field label="Temporary password" htmlFor="st-pw" error={fe.password} hint="12+ characters with upper and lower case, a number and a symbol.">
          <Input id="st-pw" name="password" type="password" required autoComplete="new-password" />
        </Field>
        {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
        <Button disabled={pending}>{pending ? "Adding…" : "Add staff member"}</Button>
      </form>
    </Card>
  );
}

/** Super admin: set a new password for someone who is locked out. */
export function SetPasswordForm({ userId, strong }: { userId: string; strong: boolean }) {
  const [state, action, pending] = useActionState<SuperState, FormData>(setPasswordAction.bind(null, userId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card className="p-5">
      <form ref={ref} action={action} className="flex flex-col gap-4">
        <div><h2 className="font-semibold">Set a new password</h2><p className="text-sm text-muted">Use when the person is locked out. They are signed out everywhere.</p></div>
        <Field label="New password" htmlFor="sp-pw" error={fe.password} hint={strong ? "12+ characters with upper and lower case, a number and a symbol." : "8+ characters with letters and a number."}>
          <Input id="sp-pw" name="password" type="password" required autoComplete="new-password" />
        </Field>
        <Field label="Repeat password" htmlFor="sp-cf" error={fe.confirm}><Input id="sp-cf" name="confirm" type="password" required autoComplete="new-password" /></Field>
        {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
        <Button variant="secondary" disabled={pending} className="self-start">{pending ? "Saving…" : "Set password"}</Button>
      </form>
    </Card>
  );
}
