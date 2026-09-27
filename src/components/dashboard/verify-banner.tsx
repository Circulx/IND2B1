"use client";

import { useActionState } from "react";
import { Icon } from "@/components/ui";
import { resendVerification, type ResendState } from "@/actions/auth";

export function VerifyBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ResendState, FormData>(resendVerification, {});

  if (state.sent) {
    return (
      <div className="flex items-center gap-2.5 rounded-card border border-line bg-subtle px-4 py-3 text-sm">
        <Icon name="check" size={16} className="text-teal-700" />
        Verification email sent to {email}. Check your inbox.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-subtle px-4 py-3 text-sm">
      <Icon name="shield" size={16} className="text-teal-700" />
      <span className="flex-1">Confirm <strong>{email}</strong> to secure your account.</span>
      <form action={action}>
        <button type="submit" disabled={pending} className="font-semibold text-teal-700 hover:underline disabled:opacity-60">
          {pending ? "Sending…" : "Resend email"}
        </button>
      </form>
      {state.error && <span className="w-full text-xs text-bad">{state.error}</span>}
    </div>
  );
}
