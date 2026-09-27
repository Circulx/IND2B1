"use client";

import { useActionState } from "react";
import type { StoreSettings } from "@/lib/types";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { saveSettings, type FormState } from "@/actions/dashboard";

const STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal"];

export function SettingsForm({ name, settings }: { name: string; settings: StoreSettings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2">
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-semibold">Store details</h2>
        <Field label="Store name" htmlFor="name" error={fe.name}><Input id="name" name="name" defaultValue={name} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact email" htmlFor="email" error={fe.email}><Input id="email" name="email" type="email" defaultValue={settings.email} required /></Field>
          <Field label="Phone" htmlFor="phone" error={fe.phone}><Input id="phone" name="phone" type="tel" defaultValue={settings.phone} /></Field>
        </div>
        <Field label="Business address" htmlFor="address" error={fe.address}><Textarea id="address" name="address" rows={3} defaultValue={settings.address} /></Field>
        <Field label="State" htmlFor="state" hint="Decides CGST + SGST (same state) or IGST (other states)."><Select id="state" name="state" defaultValue={settings.state}>{STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </Card>
      <div className="flex flex-col gap-5">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-semibold">Taxes</h2>
          <Field label="GSTIN" htmlFor="gstin" error={fe.gstin} hint="Printed on invoices. Leave empty if you are not registered."><Input id="gstin" name="gstin" mono defaultValue={settings.gstin} className="uppercase" /></Field>
          <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" name="pricesIncludeGst" defaultChecked={settings.pricesIncludeGst} className="size-4" /> Product prices include GST</label>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-semibold">Shipping</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Flat shipping rate (₹)" htmlFor="flatRate"><Input id="flatRate" name="flatRate" inputMode="decimal" mono defaultValue={settings.shipping.flatRatePaise / 100} /></Field>
            <Field label="Free shipping above (₹)" htmlFor="freeAbove" hint="Empty = never free"><Input id="freeAbove" name="freeAbove" inputMode="decimal" mono defaultValue={settings.shipping.freeAbovePaise != null ? settings.shipping.freeAbovePaise / 100 : ""} /></Field>
          </div>
        </Card>
        <div className="flex items-center justify-end gap-3">
          {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
          {state?.ok && <p role="status" className="text-sm text-ok">Settings saved.</p>}
          <Button disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
        </div>
      </div>
    </form>
  );
}
