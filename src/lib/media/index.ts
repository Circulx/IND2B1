import "server-only";
import { randomBytes } from "node:crypto";
import { connectDb } from "../db/connect";
import { MediaModel, ProductModel, StoreModel } from "../db/models";
import { mediaProvider } from "../env";
import type { ImageRef, MediaItem } from "../types";
import { ImageError, processImage } from "./process";
import { removeImage, storeImage } from "./storage";

export { ImageError, MAX_UPLOAD_BYTES } from "./process";
export { sizedUrl } from "./storage";

type Purpose = "product" | "section" | "logo";
const toItem = (m: { _id: string; storeId: string; purpose: Purpose; url: string; width: number; height: number; bytes: number; provider: "cloudinary" | "local"; alt?: string; createdAt: Date }): MediaItem =>
  ({ id: m._id, storeId: m.storeId, purpose: m.purpose, url: m.url, width: m.width, height: m.height, bytes: m.bytes, provider: m.provider, alt: m.alt ?? "", createdAt: m.createdAt.toISOString() });

/** Validates, re-encodes, stores and records one image for a store. */
export async function uploadImage(input: { storeId: string; ownerId: string; purpose: Purpose; file: Buffer; alt?: string }) {
  await connectDb();
  const count = await MediaModel.countDocuments({ storeId: input.storeId });
  if (count >= 2000) throw new ImageError("This store has reached its image limit (2,000). Delete unused images first.");
  const img = await processImage(input.file, input.purpose);
  const stored = await storeImage(input.storeId, img.data);
  const doc = {
    _id: `med_${randomBytes(9).toString("base64url")}`, storeId: input.storeId, ownerId: input.ownerId, purpose: input.purpose,
    provider: stored.provider, key: stored.key, url: stored.url, width: img.width, height: img.height, bytes: img.bytes, format: img.format,
    alt: (input.alt ?? "").slice(0, 200), createdAt: new Date(),
  };
  try {
    await MediaModel.create(doc);
  } catch (e) {
    await removeImage(stored);
    throw e;
  }
  return toItem(doc);
}

export async function listMedia(storeId: string, limit = 100) {
  await connectDb();
  return (await MediaModel.find({ storeId }).sort({ createdAt: -1 }).limit(limit).lean()).map(toItem);
}

/**
 * Turns ids sent by a form into image references, keeping only images that
 * belong to this store. URLs always come from the database, never from the browser.
 */
export async function resolveImages(storeId: string, ids: string[], alts: string[] = [], max = 12): Promise<ImageRef[]> {
  const clean = ids.filter((id) => typeof id === "string" && /^med_[A-Za-z0-9_-]{6,20}$/.test(id)).slice(0, max);
  if (!clean.length) return [];
  await connectDb();
  const rows = await MediaModel.find({ storeId, _id: { $in: clean } }).lean();
  const byId = new Map(rows.map((r) => [r._id, r]));
  return clean.flatMap((id, i) => {
    const m = byId.get(id);
    return m ? [{ id: m._id, url: m.url, alt: (alts[i] ?? m.alt ?? "").slice(0, 200), width: m.width, height: m.height }] : [];
  });
}

/** True if a product, the logo or a theme section of this store still shows the image. */
async function inUse(storeId: string, mediaId: string) {
  if (await ProductModel.exists({ storeId, "images.id": mediaId })) return true;
  const s = await StoreModel.findById(storeId, { logo: 1, theme: 1, draftTheme: 1 }).lean();
  if (!s) return false;
  if (s.logo?.id === mediaId) return true;
  return JSON.stringify([s.theme, s.draftTheme]).includes(`"${mediaId}"`);
}

/** Deletes images that nothing uses any more (called after a product, logo or theme change). */
export async function deleteUnusedMedia(storeId: string, mediaIds: string[]) {
  await connectDb();
  for (const id of new Set(mediaIds)) {
    if (await inUse(storeId, id)) continue;
    const m = await MediaModel.findOneAndDelete({ _id: id, storeId }).lean();
    if (m) await removeImage({ provider: m.provider, key: m.key });
  }
}

/** Explicit delete from the media library. Refuses while the image is in use. */
export async function deleteMedia(storeId: string, mediaId: string) {
  await connectDb();
  if (await inUse(storeId, mediaId)) return { ok: false as const, error: "This image is still used. Remove it from products, the logo or the theme first." };
  const m = await MediaModel.findOneAndDelete({ _id: mediaId, storeId }).lean();
  if (m) await removeImage({ provider: m.provider, key: m.key });
  return { ok: true as const };
}

export const currentMediaProvider = mediaProvider;
