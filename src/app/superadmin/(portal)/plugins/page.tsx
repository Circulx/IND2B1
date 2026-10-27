import { listAllStores, listApps } from "@/lib/services";
import { Button, Card, Input, PageHeader, StatusPill, Table, Td, Th } from "@/components/ui";
import { APP_TONE, ActionButton, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { pluginReviewAction } from "@/actions/superadmin-portal";

export const metadata = { title: "Plugins" };

/** Plugin review queue and the full catalogue with listing control. */
export default async function Plugins({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const [apps, stores] = await Promise.all([listApps({ includeInReview: true }), listAllStores()]);
  const queue = apps.filter((a) => a.status === "in_review");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plugins" subtitle="Approve, reject or delist any plugin. Delisted plugins disappear from the app store; stores that already installed them keep them." />
      <Flash sp={sp} />
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Waiting for review ({queue.length})</h2>
        {queue.length === 0 && <Card className="p-6 text-sm text-muted">No plugins waiting.</Card>}
        {queue.map((a) => (
          <Card key={a.id} className="grid-cols-1 grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.3fr_1fr]">
            <div className="flex min-w-0 flex-col gap-1.5 text-sm">
              <div className="text-lg font-semibold">{a.name}</div>
              <div className="text-xs text-muted">by {a.developer} · {a.pricing}</div>
              <p>{a.description}</p>
              <p className="text-xs"><span className="font-semibold">Extension points:</span> <span className="break-words font-mono">{a.extensions.join(", ")}</span></p>
            </div>
            <div className="flex flex-col gap-2.5">
              <ActionButton action={pluginReviewAction} fields={{ appId: a.id, decision: "published" }} label="Approve and list" variant="primary" size="md" className="w-full" />
              <form action={pluginReviewAction} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="appId" value={a.id} /><input type="hidden" name="decision" value="rejected" />
                <Input name="note" required placeholder="What the developer must fix" aria-label={`Rejection note for ${a.name}`} />
                <Button variant="danger">Reject</Button>
              </form>
            </div>
          </Card>
        ))}
      </section>
      <Card>
        <h2 className="p-4 pb-3 font-semibold sm:p-5 sm:pb-3">All plugins ({apps.length})</h2>
        <Table>
          <thead><tr><Th>Plugin</Th><Th className={hideBelow.md}>Category</Th><Th className={hideBelow.sm}>Status</Th><Th right className={hideBelow.sm}>Stores</Th><Th right>Control</Th></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="hover:bg-subtle">
                <Td><div className="font-medium">{a.name}</div><div className="text-xs text-muted">{a.developer}{a.builtIn && " · built-in"}</div><div className="mt-1 sm:hidden"><StatusPill tone={APP_TONE[a.status]!}>{a.status.replace("_", " ")}</StatusPill></div></Td>
                <Td className={`capitalize ${hideBelow.md}`}>{a.category}</Td>
                <Td className={hideBelow.sm}><StatusPill tone={APP_TONE[a.status]!}>{a.status.replace("_", " ")}</StatusPill></Td>
                <Td right className={hideBelow.sm}>{stores.filter((s) => s.installedApps.includes(a.id)).length}</Td>
                <Td right>
                  {a.status === "published"
                    ? <ActionButton action={pluginReviewAction} fields={{ appId: a.id, decision: "in_review" }} label="Delist" link="bad" confirm={`Hide ${a.name} from the app store and send it back to review?`} />
                    : <ActionButton action={pluginReviewAction} fields={{ appId: a.id, decision: "published" }} label="Publish" link="teal" />}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
