import { listAllStores, listApps } from "@/lib/services";
import { Button, Card, Input, PageHeader, StatusPill, Table, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { reviewApp } from "@/actions/admin";

export const metadata = { title: "Plugin review" };
const TONE = { published: "ok", in_review: "warn", rejected: "bad" } as const;

export default async function Apps() {
  await requireAdmin();
  const [apps, stores] = await Promise.all([listApps({ includeInReview: true }), listAllStores()]);
  const queue = apps.filter((a) => a.status === "in_review");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plugin review" subtitle="Check permissions, extension points, pricing and a test install before a third-party plugin is listed." />
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Waiting for review ({queue.length})</h2>
        {queue.length === 0 && <Card className="p-6 text-sm text-muted">No plugins waiting.</Card>}
        {queue.map((a) => (
          <Card key={a.id} className="grid gap-4 p-5 lg:grid-cols-[1.3fr_1fr]">
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="text-lg font-semibold">{a.name}</div>
              <div className="text-xs text-muted">by {a.developer} · {a.pricing}</div>
              <p>{a.description}</p>
              <p className="text-xs"><span className="font-semibold">Extension points:</span> <span className="font-mono">{a.extensions.join(", ")}</span></p>
            </div>
            <div className="flex flex-col gap-2.5">
              <form action={reviewApp}><input type="hidden" name="appId" value={a.id} /><input type="hidden" name="decision" value="published" /><Button className="w-full">Approve and list</Button></form>
              <form action={reviewApp} className="flex gap-2"><input type="hidden" name="appId" value={a.id} /><input type="hidden" name="decision" value="rejected" />
                <Input name="note" required placeholder="What the developer must fix" aria-label={`Rejection note for ${a.name}`} /><Button variant="danger">Reject</Button></form>
            </div>
          </Card>
        ))}
      </section>
      <Card>
        <h2 className="p-5 pb-3 font-semibold">All plugins</h2>
        <Table>
          <thead><tr><Th>Plugin</Th><Th>Developer</Th><Th>Category</Th><Th>Status</Th><Th right>Installed on</Th><Th /></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <Td className="font-medium">{a.name}</Td><Td>{a.developer}{a.builtIn && <span className="ml-1.5 text-xs text-muted">(built-in)</span>}</Td>
                <Td className="capitalize">{a.category}</Td>
                <Td><StatusPill tone={TONE[a.status]}>{a.status.replace("_", " ")}</StatusPill></Td>
                <Td right>{stores.filter((s) => s.installedApps.includes(a.id)).length}</Td>
                <Td right>{!a.builtIn && a.status !== "in_review" && (
                  <form action={reviewApp}><input type="hidden" name="appId" value={a.id} /><input type="hidden" name="decision" value="in_review" /><button className="font-sans text-[13px] font-semibold text-teal-700">Send back to review</button></form>
                )}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
