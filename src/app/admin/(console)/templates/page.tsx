import { TEMPLATES, listAllStores } from "@/lib/services";
import { Card, PageHeader, StatusPill, Table, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Templates" };

export default async function Templates() {
  await requireAdmin();
  const stores = await listAllStores();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Templates" subtitle="Templates are defined in src/lib/catalog.ts. Merchants start from one and customise it in the page builder." />
      <Card>
        <Table>
          <thead><tr><Th>Template</Th><Th>Best for</Th><Th>Sections</Th><Th>Tier</Th><Th right>Stores using</Th></tr></thead>
          <tbody>
            {TEMPLATES.map((t) => (
              <tr key={t.id}>
                <Td><div className="flex items-center gap-3"><span className="flex gap-1">{[t.tokens.primary, t.tokens.accent, t.tokens.background].map((c) => <span key={c} className="size-4 rounded-full border border-line" style={{ background: c }} />)}</span><div><div className="font-medium">{t.name}</div><div className="text-xs text-muted">{t.tagline}</div></div></div></Td>
                <Td className="capitalize">{t.bestFor.join(", ")}</Td>
                <Td className="text-xs text-muted">{t.sections.map((s) => s.type).join(" · ")}</Td>
                <Td><StatusPill tone={t.free ? "ok" : "teal"} dot={false}>{t.free ? "Free" : "Pro"}</StatusPill></Td>
                <Td right>{stores.filter((s) => s.templateId === t.id).length}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
