"use client";

import { useRef, useState } from "react";
import { Icon, IconButton, Img, cn } from "@/components/ui";
import type { ImageRef } from "@/lib/types";

/**
 * Image upload widgets for the dashboard. Files go to POST /api/uploads, where
 * the server checks, re-encodes and stores them (Cloudinary or local disk) and
 * returns an id + URL. Forms then send only the ids; the server looks up the
 * URLs itself.
 */

export type Uploaded = ImageRef;
type Purpose = "product" | "section" | "logo";
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif";
const MAX = 8 * 1024 * 1024;

export async function uploadFile(file: File, purpose: Purpose): Promise<Uploaded> {
  if (file.size > MAX) throw new Error("Images must be 8 MB or smaller.");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("purpose", purpose);
  const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "same-origin" });
  const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; width?: number; height?: number; error?: string };
  if (!res.ok || !json.id || !json.url) throw new Error(json.error ?? "Upload failed. Please try again.");
  return { id: json.id, url: json.url, width: json.width, height: json.height, alt: "" };
}

/** Several images with order and alt text (product photos). Renders hidden inputs img_id / img_alt. */
export function ImageListField({ initial, max = 10, label = "Photos" }: { initial: ImageRef[]; max?: number; label?: string }) {
  const [items, setItems] = useState<ImageRef[]>(initial);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = [...files].slice(0, Math.max(0, max - items.length));
    if (list.length < files.length) setError(`You can add up to ${max} photos.`);
    setBusy((b) => b + list.length);
    for (const f of list) {
      try {
        const up = await uploadFile(f, "product");
        setItems((xs) => [...xs, up]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = "";
  }
  const move = (i: number, d: -1 | 1) => setItems((xs) => {
    const j = i + d; if (j < 0 || j >= xs.length) return xs;
    const n = [...xs]; [n[i], n[j]] = [n[j]!, n[i]!]; return n;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{label}</h2>
        <span className="text-xs text-muted">{items.length}/{max} · first photo is the main one</span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((im, i) => (
          <li key={im.id} className="flex flex-col gap-1.5">
            <input type="hidden" name="img_id" value={im.id} />
            <div className="relative">
              <Img src={im.url} alt={im.alt} className={cn("aspect-square w-full", i === 0 && "ring-2 ring-teal-700")} />
              <div className="absolute right-1 top-1 flex gap-1">
                <IconButton type="button" icon="chevron-left" label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="size-8 bg-white/90" />
                <IconButton type="button" icon="chevron-right" label="Move later" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="size-8 bg-white/90" />
                <IconButton type="button" icon="trash" label="Remove photo" onClick={() => setItems((xs) => xs.filter((x) => x.id !== im.id))} className="size-8 bg-white/90 text-bad" />
              </div>
            </div>
            <label className="sr-only" htmlFor={`alt-${im.id}`}>Describe photo {i + 1}</label>
            <input id={`alt-${im.id}`} name="img_alt" defaultValue={im.alt} maxLength={200} placeholder="Describe the photo (for SEO and screen readers)"
              className="h-9 rounded-control border border-control px-2 text-xs" />
          </li>
        ))}
        {items.length < max && (
          <li>
            <button type="button" onClick={() => input.current?.click()} disabled={busy > 0}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-control border border-dashed border-control text-sm text-muted hover:border-teal-700 hover:text-teal-700">
              <Icon name="upload" size={22} />{busy > 0 ? `Uploading ${busy}…` : "Add photos"}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <p className="text-xs text-muted">JPG, PNG, WebP or AVIF up to 8 MB. Photos are resized and converted automatically. Removed photos are deleted when you save.</p>
    </div>
  );
}

/** One image (logo, section image). Calls onChange with the uploaded image or null. */
export function SingleImageField({ value, purpose, onChange, label, hint }: {
  value?: { id?: string; url?: string } | null; purpose: Purpose; onChange: (img: Uploaded | null) => void | Promise<void>; label: string; hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function onFile(f?: File) {
    if (!f) return;
    setBusy(true); setError(null);
    try { await onChange(await uploadFile(f, purpose)); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <div className="flex items-center gap-3">
        <Img src={value?.url} alt="" label="No image" className={purpose === "logo" ? "h-16 w-32 object-contain" : "h-20 w-28"} />
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="text-left text-sm font-semibold text-teal-700">{busy ? "Uploading…" : value?.url ? "Replace image" : "Upload image"}</button>
          {value?.url && <button type="button" onClick={() => onChange(null)} disabled={busy} className="text-left text-sm font-semibold text-bad">Remove</button>}
        </div>
      </div>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {error && <p role="alert" className="text-xs text-bad">{error}</p>}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
