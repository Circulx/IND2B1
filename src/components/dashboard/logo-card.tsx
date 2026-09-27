"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Card } from "@/components/ui";
import { setLogo } from "@/actions/dashboard";
import { SingleImageField } from "./image-upload";

export function LogoCard({ logo }: { logo?: { id: string; url: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-semibold">Logo</h2>
      <SingleImageField value={logo} purpose="logo" label="Store logo" hint="Shown in your store header instead of the store name. PNG or WebP with a transparent background works best."
        onChange={(img) => new Promise<void>((resolve) => start(async () => { await setLogo(img?.id ?? null); router.refresh(); resolve(); }))} />
      {pending && <p className="text-xs text-muted">Saving…</p>}
    </Card>
  );
}
