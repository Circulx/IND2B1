import { databaseHealth } from "@/lib/services";
import { collectionCounts } from "@/lib/services/platform";
import { Card, PageHeader, StatusPill, Table, Td, Th, formatNumber } from "@/components/ui";
import { CardHead, DetailList } from "@/components/superadmin/bits";
import { mediaProvider } from "@/lib/env";
import { requireSuperAdminPortal } from "@/lib/superadmin";

export const metadata = { title: "System health" };

/** Database, configuration and runtime status. Read-only: secrets are never shown. */
export default async function SystemHealth() {
  await requireSuperAdminPortal();
  const [db, counts] = await Promise.all([databaseHealth(), collectionCounts()]);
  const env = process.env;
  const set = (v?: string) => <StatusPill tone={v ? "ok" : "neutral"}>{v ? "Set" : "Not set"}</StatusPill>;
  const media = mediaProvider();
  const mem = process.memoryUsage();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="System health" subtitle="Live status of the database and the platform configuration. Secret values are never displayed." />
      <div className="grid-cols-1 grid gap-5 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Database</h2>
          <DetailList rows={[
            ["Connection", <StatusPill key="c" tone={db.ok ? "ok" : "bad"}>{db.ok ? "MongoDB connected" : "MongoDB error"}</StatusPill>],
            ["Ping", <span key="p" className="font-mono">{db.pingMs} ms</span>],
            ["Database", <span key="d" className="font-mono">{db.name}</span>],
          ]} />
        </Card>
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Runtime</h2>
          <DetailList rows={[
            ["Environment", <span key="e" className="font-mono">{env.NODE_ENV ?? "development"}</span>],
            ["Node.js", <span key="n" className="font-mono">{process.version}</span>],
            ["Uptime", `${Math.floor(process.uptime() / 3600)} h ${Math.floor((process.uptime() % 3600) / 60)} min`],
            ["Memory (RSS)", `${formatNumber(Math.round(mem.rss / 1048576))} MB`],
          ]} />
        </Card>
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Configuration</h2>
          <DetailList rows={[
            ["Root domain", <span key="r" className="font-mono">{env.ROOT_DOMAIN || "ind2b.com (default)"}</span>],
            ["App URL", <span key="a" className="break-all font-mono">{env.APP_URL || "http://localhost:3000 (default)"}</span>],
            ["Image storage", <StatusPill key="m" tone="ok">{media === "cloudinary" ? "Cloudinary (details in MongoDB)" : "MongoDB (GridFS)"}</StatusPill>],
            ["Email provider", <span key="em" className="font-mono">{env.EMAIL_PROVIDER || (env.NODE_ENV === "production" ? "not configured" : "console (dev)")}</span>],
            ["Session secret", set(env.SESSION_SECRET)],
            ["Super admin bootstrap", set(env.SUPERADMIN_EMAIL)],
            ["Demo data", <span key="dd" className="font-mono">{env.SEED_DEMO_DATA ?? (env.NODE_ENV === "production" ? "false" : "true")}</span>],
          ]} />
        </Card>
        <Card>
          <CardHead title="Collections" sub="Documents per MongoDB collection." />
          <Table>
            <thead><tr><Th>Collection</Th><Th right>Documents</Th></tr></thead>
            <tbody>{counts.map(([n, c]) => <tr key={n}><Td mono>{n}</Td><Td right>{formatNumber(c)}</Td></tr>)}</tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
