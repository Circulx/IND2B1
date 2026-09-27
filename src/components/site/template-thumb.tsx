import type { Template } from "@/lib/services";
import { StorefrontRenderer, themeStyle } from "@/components/sections";
import { demoContext } from "@/lib/demo";

/** Real template rendering, scaled down. What merchants see here is what they get. */
export async function TemplateThumb({ template, scale = 0.28, height = 300 }: { template: Template; scale?: number; height?: number }) {
  const ctx = await demoContext(template);
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-white" style={{ height }} aria-hidden="true">
      <div className="@container pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: 1280, transform: `scale(${scale})`, ...themeStyle(template.tokens) }}>
        <StorefrontRenderer theme={{ templateId: template.id, version: 1, tokens: template.tokens, sections: template.sections }} ctx={ctx} />
      </div>
    </div>
  );
}
