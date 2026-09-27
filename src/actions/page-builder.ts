"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publishTheme, saveDraftTheme, type SectionType } from "@/lib/services";
import { SECTION_REQUIRES_APP } from "@/components/sections";
import { requireStore } from "@/lib/merchant";
import { deleteUnusedMedia, resolveImages } from "@/lib/media";

const TYPES = [
  "announcement", "header", "hero", "featured-products", "collection-list", "image-with-text",
  "rich-text", "testimonials", "newsletter", "footer", "rfq-form", "reviews", "whatsapp-button",
] as const satisfies readonly SectionType[];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be #RRGGBB");
const themeInput = z.object({
  sections: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    type: z.enum(TYPES),
    hidden: z.boolean().optional(),
    settings: z.record(z.string().regex(/^[a-zA-Z]{1,30}$/), z.union([z.string().max(2000), z.number().finite(), z.boolean()]))
      .refine((o) => Object.keys(o).length <= 20, "Too many settings"),
  })).max(40),
  tokens: z.object({
    primary: hex, accent: hex, background: hex, text: hex, onPrimary: hex, onAccent: hex,
    radius: z.number().int().min(0).max(24), font: z.enum(["sans", "serif", "display"]),
  }),
});

export type SaveResult = { ok: true; savedAt: string; published?: number } | { ok: false; error: string };

/** Saves the page-builder draft. Shoppers keep seeing the published theme until Publish. */
export async function saveDraft(input: unknown, publish = false): Promise<SaveResult> {
  const { store } = await requireStore();
  const parsed = themeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid theme" };
  // App-provided sections are only allowed while their app is installed.
  const sections = parsed.data.sections.filter((s) => !SECTION_REQUIRES_APP[s.type] || store.installedApps.includes(SECTION_REQUIRES_APP[s.type]!));

  // Section images: keep only images uploaded to this store; the URL is always taken from the database.
  const ids = sections.map((s) => s.settings.imageId).filter((v): v is string => typeof v === "string");
  const images = new Map((await resolveImages(store.id, ids, [], 40)).map((i) => [i.id, i]));
  for (const s of sections) {
    const img = typeof s.settings.imageId === "string" ? images.get(s.settings.imageId) : undefined;
    delete s.settings.imageUrl;
    if (img) s.settings.imageUrl = img.url; else delete s.settings.imageId;
  }

  const before = JSON.stringify([store.theme, store.draftTheme]).match(/med_[A-Za-z0-9_-]{6,20}/g) ?? [];
  await saveDraftTheme(store.id, sections, parsed.data.tokens);
  let published: number | undefined;
  if (publish) {
    published = (await publishTheme(store.id)).version;
    revalidatePath("/dashboard", "layout");
  }
  // Images removed from both the draft and the live theme (and not used elsewhere) are deleted.
  const dropped = before.filter((id) => !ids.includes(id));
  if (dropped.length) await deleteUnusedMedia(store.id, dropped);
  return { ok: true, savedAt: new Date().toISOString(), published };
}
