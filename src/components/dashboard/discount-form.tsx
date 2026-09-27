"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { createDiscountAction, type FormState } from "@/actions/dashboard";

export function DiscountForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createDiscountAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <Card className="h-fit p-5">
      <h2 className="mb-4 font-semibold">Create a discount code</h2>
      <form ref={ref} action={action} className="flex flex-col gap-4">
        <Field label="Code" htmlFor="code" hint="Customers type this at checkout."><Input id="code" name="code" mono required placeholder="DIWALI20" className="uppercase" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="type"><Select id="type" name="type"><option value="percent">Percentage</option><option value="fixed">Fixed amount (₹)</option></Select></Field>
          <Field label="Value" htmlFor="value"><Input id="value" name="value" inputMode="decimal" mono required /></Field>
        </div>
        <Field label="Minimum order (₹)" htmlFor="min"><Input id="min" name="min" inputMode="decimal" mono defaultValue="0" /></Field>
        {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-ok">Discount created.</p>}
        <Button disabled={pending}>{pending ? "Creating…" : "Create discount"}</Button>
      </form>
    </Card>
  );
}
