"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { confirmEmail, type ConfirmState } from "@/actions/auth";

/**
 * A button, not an automatic confirmation on page load: mail-scanning
 * gateways (Outlook Safe Links, Gmail image proxies, corporate filters)
 * pre-fetch links inside emails, which would spend a GET-based token before
 * the person ever opens the message.
 */
export function ConfirmEmailButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmEmail, {});

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-[28px]">Email confirmed</h2>
        <p className="text-muted">Your address is verified.</p>
        <Link href="/dashboard" className="font-semibold text-teal-700">Go to your dashboard</Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Confirming…" : "Confirm my email"}</Button>
    </form>
  );
}
