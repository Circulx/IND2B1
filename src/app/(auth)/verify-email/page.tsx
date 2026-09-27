import type { Metadata } from "next";
import Link from "next/link";
import { peekEmailToken } from "@/lib/services/email-tokens";
import { ConfirmEmailButton } from "@/components/site/confirm-email-button";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = token ? await peekEmailToken(token, "verify_email") : null;

  if (!valid) {
    return (
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        <h2 className="text-[28px]">Link expired</h2>
        <p className="text-muted">This confirmation link is invalid or has already been used. You can request a new one from your dashboard.</p>
        <Link href="/login" className="font-semibold text-teal-700">Back to log in</Link>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-4">
      <div><h2 className="text-[28px]">Confirm your email</h2><p className="mt-1.5 text-muted">Confirm {valid.email} to secure your account.</p></div>
      <ConfirmEmailButton token={token} />
    </div>
  );
}
