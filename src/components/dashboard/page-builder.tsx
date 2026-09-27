"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Section, SectionType, ThemeTokens } from "@/lib/types";
import {
  SECTION_DEFAULTS, SECTION_LABELS, SECTION_REQUIRES_APP, SectionView, themeStyle, type SectionContext,
} from "@/components/sections";
import { Button, Icon, cn, type IconName } from "@/components/ui";
import { SingleImageField } from "./image-upload";
import { saveDraft } from "@/actions/page-builder";

type Draft = { sections: Section[]; tokens: ThemeTokens };
type Device = "desktop" | "tablet" | "phone";
const WIDTHS: Record<Device, number> = { desktop: 1280, tablet: 820, phone: 390 };

/** How each setting is edited. Unknown keys fall back to a text box. */
const FIELDS: Record<string, { label: string; kind: "text" | "textarea" | "number" | "select"; options?: [string, string][]; hint?: string }> = {
  text: { label: "Text", kind: "text" },
  menu: { label: "Menu items", kind: "text", hint: "Separate items with |" },
  heading: { label: "Heading", kind: "text" },
  subheading: { label: "Subheading", kind: "textarea" },
  body: { label: "Text", kind: "textarea" },
  cta: { label: "Button label", kind: "text" },
  image: { label: "Placeholder label", kind: "text", hint: "Shown only while no image is uploaded." },
  layout: { label: "Layout", kind: "select", options: [["split", "Split — text and image"], ["full", "Full-width image"], ["centered", "Centred text"]] },
  imageSide: { label: "Image position", kind: "select", options: [["left", "Left"], ["right", "Right"]] },
  count: { label: "Products to show", kind: "number" },
  collection: { label: "Collection", kind: "text", hint: "all, or a collection handle" },
  items: { label: "Testimonials", kind: "textarea", hint: "quote|name, separated by ;" },
  phone: { label: "WhatsApp number", kind: "text", hint: "Leave empty to use the store phone" },
};

const TOKEN_COLOURS: [keyof ThemeTokens, string][] = [
  ["primary", "Primary (buttons, bars)"], ["onPrimary", "Text on primary"], ["accent", "Accent (badges, highlights)"],
  ["onAccent", "Text on accent"], ["background", "Page background"], ["text", "Body text"],
];

const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function Editor({ initial, ctx, storeName, liveUrl, publishedVersion, hasDraft, appliedTemplate }: {
  initial: Draft; ctx: SectionContext; storeName: string; liveUrl: string; publishedVersion: number; hasDraft: boolean; appliedTemplate?: string;
}) {
  const [history, setHistory] = useState<{ past: Draft[]; present: Draft; future: Draft[] }>({ past: [], present: initial, future: [] });
  const draft = history.present;
  const [selected, setSelected] = useState<string | null>(draft.sections.find((s) => s.type === "hero")?.id ?? draft.sections[0]?.id ?? null);
  const [panel, setPanel] = useState<"sections" | "theme">("sections");
  const [device, setDevice] = useState<Device>("desktop");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "bad" | "muted"; text: string }>(
    appliedTemplate ? { tone: "ok", text: `Template “${appliedTemplate}” loaded as a draft. Publish to make it live.` }
      : hasDraft ? { tone: "muted", text: "You have unpublished changes." } : { tone: "muted", text: `Live version ${publishedVersion}` });
  const [pending, start] = useTransition();

  const commit = useCallback((fn: (d: Draft) => Draft) => {
    setHistory((h) => ({ past: [...h.past.slice(-49), h.present], present: fn(h.present), future: [] }));
    setDirty(true);
  }, []);
  const undo = () => setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future] } : h));
  const redo = () => setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) } : h));

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const installed = ctx.store.installedApps;
  const available = (Object.keys(SECTION_LABELS) as SectionType[]).filter((t) => !SECTION_REQUIRES_APP[t] || installed.includes(SECTION_REQUIRES_APP[t]!));
  const current = draft.sections.find((s) => s.id === selected);

  const move = (id: string, dir: -1 | 1) => commit((d) => {
    const i = d.sections.findIndex((s) => s.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= d.sections.length) return d;
    const next = [...d.sections];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return { ...d, sections: next };
  });
  const patchSection = (id: string, patch: Partial<Section>) => commit((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const setSetting = (id: string, key: string, value: string | number) => commit((d) => ({
    ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, settings: { ...s.settings, [key]: value } } : s)),
  }));
  const setImage = (id: string, img: { id: string; url: string } | null) => commit((d) => ({
    ...d, sections: d.sections.map((s) => {
      if (s.id !== id) return s;
      const { imageId: _i, imageUrl: _u, ...rest } = s.settings;
      return { ...s, settings: img ? { ...rest, imageId: img.id, imageUrl: img.url } : rest };
    }),
  }));
  const remove = (id: string) => { commit((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id) })); setSelected(null); };
  const add = (type: SectionType) => {
    const id = newId();
    commit((d) => {
      // Insert before the footer so new sections land in the page body.
      const footer = d.sections.findIndex((s) => s.type === "footer");
      const sec: Section = { id, type, settings: { ...SECTION_DEFAULTS[type] } };
      const next = [...d.sections];
      next.splice(footer < 0 ? next.length : footer, 0, sec);
      return { ...d, sections: next };
    });
    setSelected(id);
    setPanel("sections");
  };

  const save = (publish: boolean) => start(async () => {
    const res = await saveDraft(draft, publish);
    if (!res.ok) { setStatus({ tone: "bad", text: res.error }); return; }
    setDirty(false);
    setStatus({ tone: "ok", text: publish ? `Published — version ${res.published} is live.` : `Draft saved at ${new Date(res.savedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` });
  });

  const style = useMemo(() => themeStyle(draft.tokens), [draft.tokens]);
  // Fit the chosen device width into the preview pane.
  const pane = useRef<HTMLElement>(null);
  const [paneWidth, setPaneWidth] = useState(1000);
  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPaneWidth(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = Math.min(1, (paneWidth - 2) / WIDTHS[device]);

  return (
    <div className="flex h-dvh flex-col bg-ground">
      {/* ---------------------------------------------------------------- top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <a href="/dashboard/online-store" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><Icon name="chevron-left" size={16} /> Exit</a>
        <span className="h-6 w-px bg-line" />
        <span className="truncate font-semibold">{storeName}</span>
        <span className="hidden text-xs text-muted md:inline">Home page</span>
        <div className="flex-1" />
        <div className="hidden items-center rounded-control border border-line p-0.5 md:flex" role="group" aria-label="Preview size">
          {(["desktop", "tablet", "phone"] as Device[]).map((d) => (
            <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d} aria-label={`${d} preview`}
              className={cn("flex size-8 items-center justify-center rounded-[4px]", device === d ? "bg-teal-50 text-teal-700" : "text-muted hover:text-ink")}>
              <Icon name={d === "desktop" ? "monitor" : d} size={16} />
            </button>
          ))}
        </div>
        <button onClick={undo} disabled={!history.past.length} aria-label="Undo" className="flex size-9 items-center justify-center rounded-control text-ink disabled:text-line"><Icon name="undo" size={17} /></button>
        <button onClick={redo} disabled={!history.future.length} aria-label="Redo" className="flex size-9 items-center justify-center rounded-control text-ink disabled:text-line"><Icon name="redo" size={17} /></button>
        <span role="status" className={cn("hidden max-w-72 truncate text-xs lg:inline", status.tone === "ok" ? "text-ok" : status.tone === "bad" ? "text-bad" : "text-muted")}>{dirty ? "Unsaved changes" : status.text}</span>
        <a href={liveUrl} target="_blank" rel="noopener" className="hidden text-sm font-semibold text-teal-700 md:inline">View live</a>
        <Button size="sm" variant="secondary" disabled={pending || !dirty} onClick={() => save(false)}>Save draft</Button>
        <Button size="sm" disabled={pending} onClick={() => save(true)}>{pending ? "Saving…" : "Publish"}</Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------------------------------------------------------------- left: sections / theme */}
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-line bg-surface">
          <div className="grid grid-cols-2 border-b border-line" role="tablist">
            {(["sections", "theme"] as const).map((p) => (
              <button key={p} role="tab" aria-selected={panel === p} onClick={() => setPanel(p)}
                className={cn("h-11 text-sm font-semibold capitalize", panel === p ? "border-b-2 border-teal-700 text-ink" : "text-muted")}>{p === "theme" ? "Theme settings" : "Sections"}</button>
            ))}
          </div>

          {panel === "sections" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <ol className="flex-1 overflow-y-auto p-2" aria-label="Page sections">
                {draft.sections.map((s, i) => {
                  const needs = SECTION_REQUIRES_APP[s.type];
                  return (
                    <li key={s.id}>
                      <div className={cn("group flex items-center gap-1 rounded-control pr-1", selected === s.id ? "bg-teal-50" : "hover:bg-subtle")}>
                        <button onClick={() => setSelected(s.id)} className={cn("flex h-10 flex-1 items-center gap-2 truncate px-2.5 text-left text-sm", s.hidden && "text-muted line-through", selected === s.id && "font-semibold text-teal-700")}>
                          <Icon name="drag" size={14} className="shrink-0 text-muted" />{SECTION_LABELS[s.type]}
                          {needs && <span className="rounded bg-saffron-50 px-1.5 text-[10px] font-semibold text-saffron-700">Plugin</span>}
                        </button>
                        <button aria-label={`Move ${SECTION_LABELS[s.type]} up`} disabled={i === 0} onClick={() => move(s.id, -1)} className="flex size-7 items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30"><Icon name="chevron-up" size={15} /></button>
                        <button aria-label={`Move ${SECTION_LABELS[s.type]} down`} disabled={i === draft.sections.length - 1} onClick={() => move(s.id, 1)} className="flex size-7 items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30"><Icon name="chevron-down" size={15} /></button>
                        <button aria-label={s.hidden ? `Show ${SECTION_LABELS[s.type]}` : `Hide ${SECTION_LABELS[s.type]}`} onClick={() => patchSection(s.id, { hidden: !s.hidden })} className="flex size-7 items-center justify-center rounded text-muted hover:text-ink"><Icon name={s.hidden ? "eye-off" : "eye"} size={15} /></button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="border-t border-line p-3">
                <label htmlFor="add-section" className="mb-1.5 block text-xs font-medium text-muted">Add section</label>
                <select id="add-section" value="" onChange={(e) => e.target.value && add(e.target.value as SectionType)} className="h-10 w-full rounded-control border border-control bg-surface px-2 text-sm">
                  <option value="">Choose a section…</option>
                  {available.map((t) => <option key={t} value={t}>{SECTION_LABELS[t]}{SECTION_REQUIRES_APP[t] ? " (plugin)" : ""}</option>)}
                </select>
                <p className="mt-2 text-[11px] text-muted">Install plugins to get more sections, e.g. B2B quote form, reviews, WhatsApp.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto p-4">
              {TOKEN_COLOURS.map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span>{label}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">{String(draft.tokens[key])}</span>
                    <input type="color" value={String(draft.tokens[key])} onChange={(e) => commit((d) => ({ ...d, tokens: { ...d.tokens, [key]: e.target.value } }))} className="size-8 cursor-pointer rounded border border-line" />
                  </span>
                </label>
              ))}
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Corner radius: <span className="font-mono">{draft.tokens.radius}px</span></span>
                <input type="range" min={0} max={24} value={draft.tokens.radius} onChange={(e) => commit((d) => ({ ...d, tokens: { ...d.tokens, radius: Number(e.target.value) } }))} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span>Heading font</span>
                <select value={draft.tokens.font} onChange={(e) => commit((d) => ({ ...d, tokens: { ...d.tokens, font: e.target.value as ThemeTokens["font"] } }))} className="h-10 rounded-control border border-control bg-surface px-2">
                  <option value="sans">Sans — clean and modern</option><option value="serif">Serif — editorial</option><option value="display">Display — bold</option>
                </select>
              </label>
              <p className="text-xs text-muted">Text colours are checked for contrast when you publish (WCAG AA) in production.</p>
            </div>
          )}
        </aside>

        {/* ---------------------------------------------------------------- centre: live preview */}
        <main ref={pane} className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6" aria-label="Preview">
          <div className="mx-auto w-fit overflow-hidden rounded-card border border-line bg-white shadow-sm">
            {/* zoom scales layout too; transform makes the fixed WhatsApp button stay inside the preview */}
            <div className="@container" style={{ width: WIDTHS[device], zoom: scale, transform: "translateZ(0)", ...style }}>
              {draft.sections.filter((s) => !s.hidden).map((s) => (
                <div key={s.id} onClick={() => { setSelected(s.id); setPanel("sections"); }}
                  className={cn("relative cursor-pointer outline-offset-[-2px]", selected === s.id ? "outline-2 outline-teal-700 outline" : "hover:outline-2 hover:outline-dashed hover:outline-teal-700/50")}>
                  <SectionView section={s} ctx={ctx} />
                </div>
              ))}
              {draft.sections.every((s) => s.hidden) && <p className="p-16 text-center text-muted">All sections are hidden.</p>}
            </div>
          </div>
        </main>

        {/* ---------------------------------------------------------------- right: settings of selected section */}
        <aside className="hidden w-[320px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface xl:flex">
          {current ? (
            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{SECTION_LABELS[current.type]}</h2>
                <button onClick={() => remove(current.id)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-bad"><Icon name="trash" size={14} /> Remove</button>
              </div>
              {(current.type === "hero" || current.type === "image-with-text") && (
                <SingleImageField purpose="section" label="Image"
                  value={typeof current.settings.imageUrl === "string" ? { url: current.settings.imageUrl } : null}
                  hint="JPG, PNG or WebP up to 8 MB. Wide images (about 2400 px) look best."
                  onChange={(img) => setImage(current.id, img ? { id: img.id, url: img.url } : null)} />
              )}
              {Object.entries(current.settings).filter(([key]) => key !== "imageId" && key !== "imageUrl").map(([key, value]) => {
                const f = FIELDS[key] ?? { label: key, kind: "text" as const };
                const id = `f-${current.id}-${key}`;
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label htmlFor={id} className="text-[13px] font-medium text-ink-2">{f.label}</label>
                    {f.kind === "textarea" ? (
                      <textarea id={id} value={String(value)} rows={4} onChange={(e) => setSetting(current.id, key, e.target.value)} className="rounded-control border border-control px-3 py-2 text-sm" />
                    ) : f.kind === "select" ? (
                      <select id={id} value={String(value)} onChange={(e) => setSetting(current.id, key, e.target.value)} className="h-10 rounded-control border border-control bg-surface px-2 text-sm">
                        {f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : (
                      <input id={id} type={f.kind === "number" ? "number" : "text"} min={f.kind === "number" ? 1 : undefined} max={f.kind === "number" ? 24 : undefined}
                        value={String(value)} onChange={(e) => setSetting(current.id, key, f.kind === "number" ? Math.max(1, Math.min(24, Number(e.target.value) || 1)) : e.target.value)}
                        className="h-10 rounded-control border border-control px-3 text-sm" />
                    )}
                    {f.hint && <span className="text-xs text-muted">{f.hint}</span>}
                  </div>
                );
              })}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!current.hidden} onChange={(e) => patchSection(current.id, { hidden: e.target.checked })} /> Hide this section</label>
            </div>
          ) : (
            <Empty icon="layers" text="Select a section in the list or click it in the preview to edit it." />
          )}
        </aside>
      </div>
    </div>
  );
}

function Empty({ icon, text }: { icon: IconName; text: string }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted"><Icon name={icon} size={28} />{text}</div>;
}
