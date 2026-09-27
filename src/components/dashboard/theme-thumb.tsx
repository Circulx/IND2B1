import type { Theme } from "@/lib/services";
import { StorefrontRenderer, themeStyle, type SectionContext } from "@/components/sections";

/** Real storefront rendering, scaled down, used for theme and template cards. */
export function ThemeThumb({ theme, ctx, scale = 0.3, height = 260 }: { theme: Theme; ctx: SectionContext; scale?: number; height?: number }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-white" style={{ height }} aria-hidden="true">
      <div className="@container pointer-events-none absolute left-0 top-0" style={{ width: 1280, zoom: scale, transform: "translateZ(0)", ...themeStyle(theme.tokens) }}>
        <StorefrontRenderer theme={theme} ctx={{ ...ctx, preview: true }} />
      </div>
    </div>
  );
}
