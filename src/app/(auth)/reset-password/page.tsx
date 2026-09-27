import type { Metadata } from "next";
import Link from "next/link";
import { peekEmailToken } from "@/lib/services/email-tokens";
import { ResetPasswordForm } from "@/components/site/reset-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = token ? await peekEmailToken(token, "reset_password") : null;

  if (!valid) {
    return (
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        <h2 className="text-[28px]">Link expired</h2>
        <p className="text-muted">This password reset link is invalid or has already been used.</p>
        <Link href="/forgot-password" className="font-semibold text-teal-700">Request a new link</Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
