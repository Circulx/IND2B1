import type { Metadata } from "next";
import { listApps, type AppCategory } from "@/lib/services";
import { Card, PageHeader, StatusPill } from "@/components/ui";

export const metadata: Metadata = { title: "Plugins" };

const CATS: [AppCategory, string][] = [["payments", "Payments"], ["shipping", "Shipping"], ["compliance", "GST & compliance"], ["marketing", "Marketing"], ["sales", "Sales channels"], ["support", "Customer support"], ["b2b", "B2B & wholesale"]];

export default async function Plugins() {
  const apps = await listApps();
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-6 py-12">
      <PageHeader title="Plugins" subtitle="Add features to your store in one click. Install and remove them any time from your dashboard." />
      {CATS.map(([cat, label]) => {
        const list = apps.filter((a) => a.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} id={cat} className="flex scroll-mt-24 flex-col gap-4">
            <h2 className="text-xl">{label}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {list.map((a) => (
                <Card key={a.id} id={a.id} className="flex scroll-mt-24 flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-3"><h3 className="text-base">{a.name}</h3>{a.builtIn && <StatusPill tone="teal" dot={false}>By IND2B</StatusPill>}</div>
                  <p className="text-sm text-muted">{a.description}</p>
                  <div className="mt-auto flex justify-between pt-2 text-xs text-muted"><span>{a.pricing}</span><span>★ {a.rating} · {a.installs.toLocaleString("en-IN")} stores</span></div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
      <Card className="flex flex-col gap-2 p-6"><h2 className="text-lg">Build a plugin</h2><p className="text-sm text-muted">Developers can build plugins with the IND2B API and webhooks, and publish them after review. Developer docs are coming soon.</p></Card>
    </div>
  );
}
