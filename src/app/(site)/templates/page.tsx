import type { Metadata } from "next";
import Link from "next/link";
import { listTemplates } from "@/lib/services";
import { PageHeader, StatusPill } from "@/components/ui";
import { TemplateThumb } from "@/components/site/template-thumb";

export const metadata: Metadata = { title: "Store templates" };
export const revalidate = 3600;

export default async function Templates() {
  const templates = await listTemplates();
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-6 py-12">
      <PageHeader title="Store templates" subtitle="Every template is fully editable: sections, colours, fonts and layout. Switch any time without losing your products." />
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Link key={t.id} href={`/templates/${t.id}`} className="group flex flex-col gap-3">
            <TemplateThumb template={t} />
            <div className="flex items-center justify-between"><span className="font-display text-lg font-semibold group-hover:text-teal-700">{t.name}</span>{t.free ? <StatusPill tone="ok" dot={false}>Free</StatusPill> : <StatusPill tone="teal" dot={false}>Premium · Grow plan</StatusPill>}</div>
            <span className="text-sm text-muted">{t.tagline}</span>
            <span className="text-xs text-muted">Best for: {t.bestFor.join(", ")}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
