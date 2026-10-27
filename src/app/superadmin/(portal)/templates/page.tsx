import Link from "next/link";
import { TEMPLATES, listAllStores } from "@/lib/services";
import { Card, PageHeader, StatusPill } from "@/components/ui";
import { requireSuperAdminPortal } from "@/lib/superadmin";

export const metadata = { title: "Templates" };

/** Store templates and which stores use them. Templates are defined in src/lib/catalog.ts. */
export default async function Templates() {
  await requireSuperAdminPortal();
  const stores = await listAllStores();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Templates" subtitle="Defined in src/lib/catalog.ts. Merchants start from one and customise it in the page builder." />
      <div className="grid-cols-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => {
          const using = stores.filter((s) => s.templateId === t.id);
          return (
            <Card key={t.id} className="flex flex-col overflow-hidden">
              <div className="flex h-24 items-end gap-2 p-4" style={{ background: t.tokens.background }}>
                {[t.tokens.primary, t.tokens.accent, t.tokens.text].map((c) => <span key={c} className="size-8 rounded-full border border-black/10" style={{ background: c }} />)}
                <span className="ml-auto"><StatusPill tone={t.free ? "ok" : "teal"} dot={false}>{t.free ? "Free" : "Pro"}</StatusPill></span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="font-semibold">{t.name}</div>
                <p className="text-sm text-muted">{t.tagline}</p>
                <p className="text-xs capitalize text-muted">Best for: {t.bestFor.join(", ")}</p>
                <p className="text-xs text-muted">{t.sections.length} sections · font {t.tokens.font} · radius {t.tokens.radius}px</p>
                <div className="mt-auto pt-2 text-sm">
                  <span className="font-semibold">{using.length} store{using.length === 1 ? "" : "s"}</span>
                  {using.length > 0 && <span className="text-muted">: {using.slice(0, 3).map((s, i) => <span key={s.id}>{i > 0 && ", "}<Link href={`/superadmin/stores/${s.id}`} className="text-teal-700">{s.name}</Link></span>)}{using.length > 3 && ` +${using.length - 3}`}</span>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
