"use client";

import { useActionState, useState } from "react";
import type { Product } from "@/lib/types";
import { Button, Card, Field, IconButton, Input, Select, Textarea } from "@/components/ui";
import { ImageListField } from "./image-upload";
import { saveProduct, type FormState } from "@/actions/dashboard";

const rupees = (p?: number) => (p ? String(p / 100) : "");
type Row = { key: string; id?: string; title: string; sku: string; price: string; compare: string; stock: string };

export function ProductForm({ productId, initial, collections, b2b, pricesIncludeGst }: {
  productId: string | null; initial?: Product; collections: string[]; b2b: boolean; pricesIncludeGst: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProduct.bind(null, productId), undefined);
  const [rows, setRows] = useState<Row[]>(() => (initial?.variants ?? [{ id: undefined, title: "Default", sku: "", pricePaise: 0, stock: 10 }]).map((v, i) => ({
    key: `r${i}`, id: v.id, title: v.title, sku: v.sku, price: rupees(v.pricePaise), compare: rupees("compareAtPaise" in v ? v.compareAtPaise : undefined), stock: String(v.stock),
  })));
  const [tiers, setTiers] = useState(() => (initial?.tiers ?? []).map((t, i) => ({ key: `t${i}`, qty: String(t.minQty), price: rupees(t.pricePaise) })));
  const fe = state?.fieldErrors ?? {};
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-5">
        <Card className="flex flex-col gap-4 p-5">
          <Field label="Title" htmlFor="title" error={fe.title}><Input id="title" name="title" defaultValue={initial?.title} required placeholder="e.g. Handloom cotton saree" /></Field>
          <Field label="Description" htmlFor="description"><Textarea id="description" name="description" defaultValue={initial?.description} rows={5} /></Field>
        </Card>

        <Card className="p-5">
          <ImageListField initial={initial?.images ?? []} />
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Variants and pricing</h2>
            <Button type="button" variant="ghost" size="sm" icon="plus" onClick={() => setRows((rs) => [...rs, { key: `r${Date.now()}`, title: "", sku: "", price: rs[0]?.price ?? "", compare: "", stock: "0" }])}>Add variant</Button>
          </div>
          <p className="text-xs text-muted">Prices in ₹, {pricesIncludeGst ? "including GST" : "before GST"}. Add sizes or colours as separate variants.</p>
          <div className="hidden grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.7fr_44px] gap-2 text-[11.5px] font-semibold uppercase tracking-wider text-muted md:grid">
            <span>Variant</span><span>SKU</span><span>Price</span><span>MRP</span><span>Stock</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={r.key} className="grid grid-cols-2 gap-2 md:grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.7fr_44px]">
              <input type="hidden" name="v_id" value={r.id ?? ""} />
              <Input name="v_title" aria-label={`Variant ${i + 1} name`} value={r.title} onChange={(e) => update(r.key, { title: e.target.value })} placeholder="e.g. M / Blue" required />
              <Input name="v_sku" aria-label={`Variant ${i + 1} SKU`} mono value={r.sku} onChange={(e) => update(r.key, { sku: e.target.value })} />
              <Input name="v_price" aria-label={`Variant ${i + 1} price`} inputMode="decimal" mono value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} required placeholder="₹" />
              <Input name="v_compare" aria-label={`Variant ${i + 1} MRP`} inputMode="decimal" mono value={r.compare} onChange={(e) => update(r.key, { compare: e.target.value })} placeholder="optional" />
              <Input name="v_stock" aria-label={`Variant ${i + 1} stock`} inputMode="numeric" mono value={r.stock} onChange={(e) => update(r.key, { stock: e.target.value })} />
              <IconButton type="button" icon="trash" label={`Remove variant ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
            </div>
          ))}
        </Card>

        {b2b && (
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <div><h2 className="font-semibold">Bulk price tiers</h2><p className="text-xs text-muted">From the B2B Wholesale plugin. Buyers get the tier price when they order at least this quantity.</p></div>
              <Button type="button" variant="ghost" size="sm" icon="plus" onClick={() => setTiers((t) => [...t, { key: `t${Date.now()}`, qty: "", price: "" }])}>Add tier</Button>
            </div>
            {tiers.map((t, i) => (
              <div key={t.key} className="grid grid-cols-[1fr_1fr_44px] gap-2">
                <Input name="t_qty" aria-label={`Tier ${i + 1} minimum quantity`} inputMode="numeric" mono defaultValue={t.qty} placeholder="Min qty" />
                <Input name="t_price" aria-label={`Tier ${i + 1} price`} inputMode="decimal" mono defaultValue={t.price} placeholder="₹ per unit" />
                <IconButton type="button" icon="trash" label={`Remove tier ${i + 1}`} onClick={() => setTiers((ts) => ts.filter((x) => x.key !== t.key))} />
              </div>
            ))}
            {tiers.length === 0 && <p className="text-sm text-muted">No tiers. Everyone pays the variant price.</p>}
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Card className="flex flex-col gap-4 p-5">
          <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue={initial?.status ?? "active"}><option value="active">Active — visible in store</option><option value="draft">Draft — hidden</option></Select></Field>
          <Field label="Collection" htmlFor="collection" error={fe.collection} hint="Products are grouped by collection in your store.">
            <Input id="collection" name="collection" list="collections" defaultValue={initial?.collection ?? collections[0] ?? ""} required />
            <datalist id="collections">{collections.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-semibold">Tax</h2>
          <Field label="GST rate" htmlFor="gstRate" error={fe.gstRate}><Select id="gstRate" name="gstRate" defaultValue={String(initial?.gstRate ?? 5)}>{[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</Select></Field>
          <Field label="HSN code" htmlFor="hsn" error={fe.hsn} hint="Shown on GST invoices."><Input id="hsn" name="hsn" mono defaultValue={initial?.hsn} inputMode="numeric" /></Field>
        </Card>
        <div className="flex flex-col gap-2">
          {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
          {state?.ok && <p role="status" className="text-sm text-ok">Saved.</p>}
          <Button disabled={pending}>{pending ? "Saving…" : productId ? "Save product" : "Add product"}</Button>
        </div>
      </div>
    </form>
  );
}
