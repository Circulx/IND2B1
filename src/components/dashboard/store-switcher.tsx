"use client";

import type { Store } from "@/lib/types";
import { switchStore } from "@/actions/store-switch";

export function StoreSwitcher({ stores, activeId }: { stores: Pick<Store, "id" | "name" | "slug">[]; activeId: string }) {
  return (
    <form action={switchStore} className="flex flex-col gap-1.5">
      <label htmlFor="store-switch" className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted">Store</label>
      <select id="store-switch" name="storeId" defaultValue={activeId} onChange={(e) => {
        if (e.target.value === "__new") { window.location.assign("/start"); return; }
        e.currentTarget.form?.requestSubmit();
      }} className="h-11 rounded-control border border-control bg-surface px-2.5 text-sm font-semibold">
        {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        <option value="__new">+ Create another store</option>
      </select>
    </form>
  );
}
