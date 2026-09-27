"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { connectDomain, type FormState } from "@/actions/dashboard";

export function DomainForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(connectDomain, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="host" className="text-[13px] font-medium text-ink-2">Connect a domain you own</label>
      <div className="flex max-w-lg gap-2">
        <Input id="host" name="host" mono placeholder="www.yourbrand.in" required />
        <Button disabled={pending} variant="secondary">Connect</Button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}
