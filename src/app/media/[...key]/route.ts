import { readStoredImage } from "@/lib/media/storage";

/**
 * GET /media/<storeId>/<name>.webp — images stored in MongoDB (GridFS bucket "media") when Cloudinary
 * is not configured; files from older versions in the legacy upload folder are still served.
 * The key is checked against a strict pattern, so nothing else can be read.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const data = await readStoredImage(key).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
