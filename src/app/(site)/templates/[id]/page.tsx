import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/services";
import { StorefrontRenderer, themeStyle } from "@/components/sections";
import { ButtonLink } from "@/components/ui";
import { demoContext } from "@/lib/demo";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const t = await getTemplate((await params).id);
  return t ? { title: `${t.name} template` } : {};
}

export default async function TemplatePreview({ params }: { params: Promise<{ id: string }> }) {
  const template = await getTemplate((await params).id);
  if (!template) notFound();
  const ctx = await demoContext(template);
  return (
    <div>
      <div className="sticky top-[68px] z-10 flex flex-wrap items-center gap-4 border-b border-line bg-surface px-6 py-3">
        <Link href="/templates" className="text-sm font-semibold text-teal-700">← All templates</Link>
        <span className="font-display text-lg font-semibold">{template.name}</span>
        <span className="hidden text-sm text-muted md:inline">{template.tagline}</span>
        <div className="flex-1" />
        <ButtonLink href={`/start?template=${template.id}`}>Start with {template.name}</ButtonLink>
      </div>
      <div className="bg-[#e7eae4] p-6">
        <div className="@container mx-auto max-w-[1280px] overflow-hidden rounded-card shadow-lg" style={themeStyle(template.tokens)}>
          <StorefrontRenderer theme={{ templateId: template.id, version: 1, tokens: template.tokens, sections: template.sections }} ctx={ctx} />
        </div>
      </div>
    </div>
  );
}
