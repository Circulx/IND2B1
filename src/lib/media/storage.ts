import "server-only";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env, mediaProvider } from "../env";



export type Stored = { provider: "cloudinary" | "local"; key: string; url: string };
const KEY_RE = /^[a-z0-9_-]{1,64}\/[a-z0-9]{24}\.webp$/;

export const localDir = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), env().UPLOAD_DIR);
export const isValidLocalKey = (key: string) => KEY_RE.test(key);

function cloudinarySign(params: Record<string, string>) {
  const e = env();
  const base = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(base + e.CLOUDINARY_API_SECRET).digest("hex");
}

export async function storeImage(storeId: string, data: Buffer): Promise<Stored> {
  const name = randomBytes(12).toString("hex");
  if (!/^[a-z0-9_-]{1,64}$/.test(storeId)) throw new Error("invalid_store_id");

  if (mediaProvider() === "cloudinary") {
    const e = env();
    const params = { folder: `${e.CLOUDINARY_FOLDER}/${storeId}`, public_id: name, timestamp: String(Math.floor(Date.now() / 1000)) };
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(data)], { type: "image/webp" }), `${name}.webp`);
    for (const [k, v] of Object.entries(params)) form.append(k, v);
    form.append("api_key", e.CLOUDINARY_API_KEY!);
    form.append("signature", cloudinarySign(params));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`cloudinary_upload_failed:${res.status}`);
    const json = (await res.json()) as { secure_url: string; public_id: string };
    // f_auto,q_auto: Cloudinary serves WebP/AVIF per browser at a sensible quality.
    return { provider: "cloudinary", key: json.public_id, url: json.secure_url.replace("/image/upload/", "/image/upload/f_auto,q_auto/") };
  }

  const key = `${storeId}/${name}.webp`;
  const file = path.join(localDir(), key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data, { flag: "wx" });
  return { provider: "local", key, url: `/media/${key}` };
}

export async function removeImage(stored: { provider: "cloudinary" | "local"; key: string }) {
  if (stored.provider === "cloudinary") {
    const e = env();
    if (!e.CLOUDINARY_CLOUD_NAME) return;
    const params = { invalidate: "true", public_id: stored.key, timestamp: String(Math.floor(Date.now() / 1000)) };
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) form.append(k, v);
    form.append("api_key", e.CLOUDINARY_API_KEY!);
    form.append("signature", cloudinarySign(params));
    await fetch(`https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/image/destroy`, { method: "POST", body: form }).catch(() => {});
    return;
  }
  if (!isValidLocalKey(stored.key)) return;
  await fs.rm(path.join(localDir(), stored.key), { force: true });
}

/** Cloudinary URLs can be resized on the fly; local files are already at most 2000 px. */
export function sizedUrl(url: string, width: number) {
  return url.includes("res.cloudinary.com/") ? url.replace("/image/upload/f_auto,q_auto/", `/image/upload/f_auto,q_auto,c_limit,w_${width}/`) : url;
}
