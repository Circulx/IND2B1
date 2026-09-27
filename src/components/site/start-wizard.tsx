"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Template } from "@/lib/types";
import { Button, Card, Field, Icon, Input, Select, cn } from "@/components/ui";
import { checkSlug, createStoreAction, type StartState } from "@/actions/start";

const CATEGORIES = [["fashion", "Fashion & accessories"], ["electronics", "Electronics & gadgets"], ["grocery", "Grocery & daily needs"], ["beauty", "Beauty & personal care"], ["home", "Home & living"], ["food", "Food & bakery"], ["b2b", "Wholesale / B2B"], ["other", "Something else"]] as const;
const toSlug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

export function StartWizard({ templates, initialName, initialTemplate, rootDomain }: { templates: Template[]; initialName: string; initialTemplate?: string; rootDomain: string }) {
  const [state, action, pending] = useActionState<StartState, FormData>(createStoreAction, {});
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(toSlug(initialName));
  const [slugEdited, setSlugEdited] = useState(false);
  const [avail, setAvail] = useState<boolean | null>(null);
  const [, startCheck] = useTransition();
  const [category, setCategory] = useState("fashion");
  const [templateId, setTemplateId] = useState(initialTemplate ?? "");
  const e = state.errors ?? {};

  useEffect(() => { if (state.redirectTo) window.location.assign(state.redirectTo); }, [state.redirectTo]);
  useEffect(() => {
    if (slug.length < 3) { setAvail(null); return; }
    const t = setTimeout(() => startCheck(async () => { const r = await checkSlug(slug); setAvail(r.slug === slug && r.available); }), 300);
    return () => clearTimeout(t);
  }, [slug]);
  const recommended = templates.filter((t) => t.bestFor.includes(category as Template["bestFor"][number]));
  useEffect(() => { if (!initialTemplate && recommended[0]) setTemplateId(recommended[0].id); }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {e.form && <p role="alert" className="text-sm text-bad">{e.form}</p>}
      <Card className="flex flex-col gap-5 p-6">
        <h2 className="text-lg">1. Name your store</h2>
        <Field label="Store name" htmlFor="name" error={e.name} hint="Your brand name. You can change it later.">
          <Input id="name" name="name" value={name} onChange={(ev) => { setName(ev.target.value); if (!slugEdited) setSlug(toSlug(ev.target.value)); }} placeholder="Priya Handlooms" />
        </Field>
        <Field label="Store address" htmlFor="slug" error={e.slug}>
          <div className="flex h-11 items-center rounded-control border border-control bg-surface pr-3 focus-within:border-teal-700">
            <input id="slug" name="slug" value={slug} onChange={(ev) => { setSlugEdited(true); setSlug(toSlug(ev.target.value)); }} className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none" aria-describedby="slug-status" />
            <span className="font-mono text-sm text-muted">.{rootDomain}</span>
          </div>
          <span id="slug-status" aria-live="polite" className={cn("flex items-center gap-1 text-xs", avail ? "text-ok" : avail === false ? "text-bad" : "text-muted")}>
            {avail === null ? "3–30 letters, numbers or hyphens" : avail ? <><Icon name="check" size={13} /> {slug}.{rootDomain} is available</> : "Not available. Try another."}
          </span>
        </Field>
      </Card>
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg">2. What will you sell?</h2>
        <Select aria-label="Category" name="category" value={category} onChange={(ev) => setCategory(ev.target.value)}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
      </Card>
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg">3. Pick a template</h2>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Template</legend>
          {templates.map((t) => (
            <label key={t.id} className="flex cursor-pointer gap-3 rounded-card border border-line p-4 has-[:checked]:border-2 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-100">
              <input type="radio" name="templateId" value={t.id} checked={templateId === t.id} onChange={() => setTemplateId(t.id)} className="mt-1" />
              <span className="flex flex-1 flex-col gap-1">
                <span className="flex items-center gap-2"><b>{t.name}</b>{recommended.some((x) => x.id === t.id) && <span className="rounded-full bg-teal-50 px-2 text-[11px] font-semibold text-teal-700">Recommended</span>}</span>
                <span className="text-xs text-muted">{t.tagline}</span>
                <span className="mt-1 flex gap-1.5" aria-hidden="true">{[t.tokens.primary, t.tokens.accent, t.tokens.background].map((c) => <span key={c} className="size-4 rounded-full border border-line" style={{ background: c }} />)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {e.templateId && <span className="text-xs text-bad">{e.templateId}</span>}
      </Card>
      <Button type="submit" size="lg" disabled={pending || avail === false || !!state.redirectTo}>{pending || state.redirectTo ? "Creating your store…" : "Create my store"}</Button>
    </form>
  );
}
