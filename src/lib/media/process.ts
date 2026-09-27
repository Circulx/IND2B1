import "server-only";
import sharp from "sharp";

/**
 * Every uploaded image is decoded and re-encoded on the server:
 *  - only real JPEG / PNG / WebP / AVIF / GIF / HEIC images get through (checked by decoding, not by file name);
 *  - EXIF data (GPS location, camera serial) is removed;
 *  - oversized "decompression bomb" images are rejected;
 *  - the result is a resized WebP, so pages load fast.
 * SVG is not accepted (it can contain scripts).
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp", "avif", "gif", "heif"]);
const MAX_SIDE: Record<string, number> = { product: 2000, section: 2400, logo: 800 };

export class ImageError extends Error {}

export async function processImage(input: Buffer, purpose: "product" | "section" | "logo") {
  if (input.length === 0) throw new ImageError("The file is empty.");
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageError("Images must be 8 MB or smaller.");
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" }).metadata();
  } catch {
    throw new ImageError("This file is not a supported image. Use JPG, PNG, WebP or AVIF.");
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new ImageError("Use a JPG, PNG, WebP or AVIF image.");
  if (!meta.width || !meta.height || meta.width < 50 || meta.height < 50) throw new ImageError("The image is too small (at least 50 × 50 pixels).");

  const side = MAX_SIDE[purpose] ?? 2000;
  const { data, info } = await sharp(input, { limitInputPixels: 50_000_000, animated: false })
    .rotate()                                                  // apply the camera orientation, then drop EXIF
    .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
    .webp({ quality: purpose === "logo" ? 90 : 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, bytes: info.size, format: "webp" as const };
}
