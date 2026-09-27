import fs from "node:fs/promises";
import path from "node:path";
import { isValidLocalKey, localDir } from "@/lib/media/storage";

/**
 * GET /media/<storeId>/<name>.webp — images stored on local disk (when Cloudinary is not configured).
 * The key is checked against a strict pattern, so no path outside the upload folder can be read.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!isValidLocalKey(key)) return new Response("Not found", { status: 404 });
  const root = localDir();
  const file = path.resolve(root, key);
  if (!file.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
