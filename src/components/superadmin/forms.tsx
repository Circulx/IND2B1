"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import {
  createAccountAction, deleteStoreAction, updatePlanAction, editAccountAction, editStoreAction, setAccountPasswordAction, superAdminLogIn, transferStoreAction,
  type PortalLoginState, type PortalState,
} from "@/actions/superadmin-portal";

const Status = ({ state }: { state: PortalState }) => (
  <>
    {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    {state?.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
  </>
);

/* ------------------------------------------------------------------ sign-in */
type Demo = { email: string; password: string; label: string };

export function PortalLoginForm({ next, notice, demo }: { next?: string; notice?: string; demo?: Demo }) {
  const [state, action, pending] = useActionState<PortalLoginState, FormData>(superAdminLogIn, {});
  const [show, setShow] = useState(false);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="flex w-full flex-col gap-5">
      <div>
        <h1 className="text-[26px] leading-tight">Super admin sign-in</h1>
        <p className="mt-1.5 text-sm text-muted">Complete control of the IND2B platform. Every sign-in and action is recorded.</p>
      </div>
      {notice && <p role="status" className="rounded-control bg-info-50 p-3 text-sm text-info">{notice}</p>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Work email" htmlFor="sa-email">
        <Input ref={email} id="sa-email" name="email" type="email" autoComplete="username" inputMode="email" defaultValue={state.values?.email} required autoFocus />
      </Field>
      <Field label="Password" htmlFor="sa-password" error={state.error}>
        <div className="relative">
          <Input ref={password} id="sa-password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-12" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-1 top-1 inline-flex size-9 items-center justify-center rounded-control text-muted hover:bg-subtle">
            <Icon name={show ? "eye-off" : "eye"} size={18} />
          </button>
        </div>
      </Field>
      <a href="/superadmin/forgot-password" className="-mt-2 self-end text-sm font-semibold text-teal-700">Forgot password?</a>
      <Button type="submit" size="lg" disabled={pending} icon="lock">{pending ? "Signing in…" : "Sign in to control centre"}</Button>
      {demo && (
        <button type="button" onClick={() => { if (email.current && password.current) { email.current.value = demo.email; password.current.value = demo.password; } }}
          className="flex flex-col gap-1 rounded-card border border-line bg-subtle p-3.5 text-left text-[13px] hover:bg-teal-50">
          <span className="font-semibold">Demo super admin (development only) · tap to fill</span>
          <span className="break-all font-mono text-xs text-muted">{demo.email} · {demo.password}</span>
        </button>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ accounts */
export function CreateAccountForm() {
  const [state, action, pending] = useActionState<PortalState, FormData>(createAccountAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  const fe = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  return (
    <Card className="h-fit p-4 sm:p-5">
      <h2 className="font-semibold">Create an account</h2>
      <p className="mb-4 mt-0.5 text-sm text-muted">Merchants sign in at /login. Admins at /admin/login. Super admins here or at /admin/login.</p>
      <form ref={ref} action={action} className="flex flex-col gap-4">
        <Field label="Account type" htmlFor="ca-role">
          <Select key={v.role ?? "merchant"} id="ca-role" name="role" defaultValue={v.role ?? "merchant"}>
            <option value="merchant">Merchant (store owner)</option>
            <option value="admin">Admin (IND2B staff)</option>
            <option value="superadmin">Super admin (complete control)</option>
          </Select>
        </Field>
        <Field label="Name" htmlFor="ca-name" error={fe.name}><Input id="ca-name" name="name" defaultValue={v.name} required autoComplete="off" /></Field>
        <Field label="Email" htmlFor="ca-email" error={fe.email}><Input id="ca-email" name="email" type="email" defaultValue={v.email} required autoComplete="off" /></Field>
        <Field label="Mobile (optional)" htmlFor="ca-phone" error={fe.phone}><Input id="ca-phone" name="phone" type="tel" defaultValue={v.phone} autoComplete="off" /></Field>
        <Field label="Temporary password" htmlFor="ca-pw" error={fe.password} hint="Merchants: 8+ characters with letters and a number. Staff: 12+ with upper and lower case, a number and a symbol.">
          <Input id="ca-pw" name="password" type="password" required autoComplete="new-password" />
        </Field>
        <Status state={state} />
        <Button disabled={pending} icon="plus">{pending ? "Creating…" : "Create account"}</Button>
      </form>
    </Card>
  );
}

export function EditAccountForm({ userId, name, email, phone }: { userId: string; name: string; email: string; phone: string }) {
  const [state, action, pending] = useActionState<PortalState, FormData>(editAccountAction.bind(null, userId), undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card className="p-4 sm:p-5">
      <form action={action} className="flex flex-col gap-4">
        <div><h2 className="font-semibold">Edit profile</h2><p className="text-sm text-muted">Changing the email signs the user out everywhere.</p></div>
        <div className="grid-cols-1 grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="ea-name" error={fe.name}><Input id="ea-name" name="name" defaultValue={name} required /></Field>
          <Field label="Mobile" htmlFor="ea-phone" error={fe.phone}><Input id="ea-phone" name="phone" type="tel" defaultValue={phone} /></Field>
        </div>
        <Field label="Email" htmlFor="ea-email" error={fe.email}><Input id="ea-email" name="email" type="email" defaultValue={email} required /></Field>
        <Status state={state} />
        <Button disabled={pending} className="self-start">{pending ? "Saving…" : "Save profile"}</Button>
      </form>
    </Card>
  );
}

export function SetPasswordForm({ userId, strong }: { userId: string; strong: boolean }) {
  const [state, action, pending] = useActionState<PortalState, FormData>(setAccountPasswordAction.bind(null, userId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card className="p-4 sm:p-5">
      <form ref={ref} action={action} className="flex flex-col gap-4">
        <div><h2 className="font-semibold">Set a new password</h2><p className="text-sm text-muted">For someone who is locked out. They are signed out everywhere.</p></div>
        <Field label="New password" htmlFor="sp-pw" error={fe.password} hint={strong ? "12+ characters with upper and lower case, a number and a symbol." : "8+ characters with letters and a number."}>
          <Input id="sp-pw" name="password" type="password" required autoComplete="new-password" />
        </Field>
        <Field label="Repeat password" htmlFor="sp-cf" error={fe.confirm}><Input id="sp-cf" name="confirm" type="password" required autoComplete="new-password" /></Field>
        <Status state={state} />
        <Button variant="secondary" disabled={pending} className="self-start">{pending ? "Saving…" : "Set password"}</Button>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ stores */
const CATEGORIES = ["fashion", "electronics", "grocery", "beauty", "home", "food", "b2b", "other"] as const;

export function EditStoreForm({ storeId, values }: { storeId: string; values: { name: string; category: string; email: string; phone: string; address: string; state: string; gstin: string } }) {
  const [state, action, pending] = useActionState<PortalState, FormData>(editStoreAction.bind(null, storeId), undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card className="p-4 sm:p-5">
      <form action={action} className="flex flex-col gap-4">
        <div><h2 className="font-semibold">Store details</h2><p className="text-sm text-muted">Edit what the merchant would edit under Settings.</p></div>
        <div className="grid-cols-1 grid gap-4 sm:grid-cols-2">
          <Field label="Store name" htmlFor="es-name" error={fe.name}><Input id="es-name" name="name" defaultValue={values.name} required /></Field>
          <Field label="Category" htmlFor="es-cat" error={fe.category}>
            <Select id="es-cat" name="category" defaultValue={values.category}>{CATEGORIES.map((c) => <option key={c} value={c}>{c === "b2b" ? "B2B / wholesale" : c[0]!.toUpperCase() + c.slice(1)}</option>)}</Select>
          </Field>
          <Field label="Contact email" htmlFor="es-email" error={fe.email}><Input id="es-email" name="email" type="email" defaultValue={values.email} required /></Field>
          <Field label="Phone" htmlFor="es-phone" error={fe.phone}><Input id="es-phone" name="phone" type="tel" defaultValue={values.phone} /></Field>
          <Field label="Address" htmlFor="es-addr" error={fe.address} className="sm:col-span-2"><Input id="es-addr" name="address" defaultValue={values.address} /></Field>
          <Field label="State" htmlFor="es-state" error={fe.state}><Input id="es-state" name="state" defaultValue={values.state} required /></Field>
          <Field label="GSTIN" htmlFor="es-gst" error={fe.gstin}><Input id="es-gst" name="gstin" defaultValue={values.gstin} mono /></Field>
        </div>
        <Status state={state} />
        <Button disabled={pending} className="self-start">{pending ? "Saving…" : "Save store details"}</Button>
      </form>
    </Card>
  );
}

export function TransferStoreForm({ storeId }: { storeId: string }) {
  const [state, action, pending] = useActionState<PortalState, FormData>(transferStoreAction.bind(null, storeId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <Card className="p-4 sm:p-5">
      <form ref={ref} action={action} className="flex flex-col gap-3">
        <div><h2 className="font-semibold">Transfer ownership</h2><p className="text-sm text-muted">Move this store to another merchant account (for example after a business sale).</p></div>
        <Field label="New owner's email" htmlFor="ts-email" error={state?.fieldErrors?.email}><Input id="ts-email" name="email" type="email" required placeholder="merchant@example.in" /></Field>
        <Status state={state} />
        <Button variant="secondary" disabled={pending} className="self-start">{pending ? "Transferring…" : "Transfer store"}</Button>
      </form>
    </Card>
  );
}

export function DeleteStoreForm({ storeId, slug }: { storeId: string; slug: string }) {
  const [state, action, pending] = useActionState<PortalState, FormData>(deleteStoreAction.bind(null, storeId), undefined);
  const [typed, setTyped] = useState("");
  return (
    <Card className="border-[#e6b8b3] p-4 sm:p-5">
      <form action={action} className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-bad"><Icon name="alert" size={18} />Delete store permanently</h2>
          <p className="mt-0.5 text-sm text-muted">Deletes the store with all its products, orders, discount codes, shopper accounts, subscribers, quote requests, images and KYC files. This cannot be undone.</p>
        </div>
        <Field label={<>Type <span className="font-mono font-semibold text-ink">{slug}</span> to confirm</>} htmlFor="ds-confirm" error={state?.fieldErrors?.confirm}>
          <Input id="ds-confirm" name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" mono />
        </Field>
        <Status state={state} />
        <Button variant="danger" disabled={pending || typed.trim().toLowerCase() !== slug} icon="trash" className="self-start">{pending ? "Deleting…" : "Delete this store"}</Button>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ plans */
export function PlanForm({ plan, stores }: { plan: { id: string; name: string; pricePaise: number | null; transactionFeePct: number; features: string[] }; stores: number }) {
  const [state, action, pending] = useActionState<PortalState, FormData>(updatePlanAction.bind(null, plan.id), undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card className="p-4 sm:p-5">
      <form action={action} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{plan.name}</h2><span className="font-mono text-xs text-muted">{plan.id} · {stores} store{stores === 1 ? "" : "s"}</span></div>
        <Field label="Plan name" htmlFor={`pl-n-${plan.id}`} error={fe.name}><Input id={`pl-n-${plan.id}`} name="name" defaultValue={plan.name} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price / month (₹)" htmlFor={`pl-p-${plan.id}`} error={fe.price}><Input id={`pl-p-${plan.id}`} name="price" type="number" min={0} step="1" inputMode="numeric" defaultValue={(plan.pricePaise ?? 0) / 100} required /></Field>
          <Field label="Transaction fee (%)" htmlFor={`pl-f-${plan.id}`} error={fe.fee}><Input id={`pl-f-${plan.id}`} name="fee" type="number" min={0} max={20} step="0.01" inputMode="decimal" defaultValue={plan.transactionFeePct} required /></Field>
        </div>
        <Field label="Features (one per line)" htmlFor={`pl-x-${plan.id}`} error={fe.features}><Textarea id={`pl-x-${plan.id}`} name="features" defaultValue={plan.features.join("\n")} rows={5} /></Field>
        <Status state={state} />
        <Button disabled={pending} variant="secondary" className="self-start">{pending ? "Saving…" : "Save plan"}</Button>
      </form>
    </Card>
  );
}
