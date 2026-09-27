import Link from "next/link";
import { databaseHealth, listAllStores, platformStats } from "@/lib/services";
import { Card, KpiCard, PageHeader, StatusPill, Table, Td, Th, formatINRCompact } from "@/components/ui";
import { BarChart } from "@/components/ui/bar-chart";
import { requireAdmin } from "@/lib/admin";
import { recentAudit } from "@/lib/audit";

export const metadata = { title: { absolute: "Overview · IND2B admin" } };

export default async function Overview() {
  await requireAdmin();
  const [stats, stores, log, dbh] = await Promise.all([platformStats(), listAllStores(), recentAudit(8), databaseHealth()]);
  const recent = [...stores].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Platform overview" subtitle="All stores on IND2B." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Stores" value={stats.stores} hint={`${stats.activeStores} live`} icon="store" />
        <KpiCard label="GMV, all stores" value={formatINRCompact(stats.gmvPaise)} hint={`${stats.orders} orders`} icon="rupee" />
        <KpiCard label="KYC waiting" value={stats.kycPending} hint={<Link href="/admin/kyc" className="font-semibold text-teal-700">Review</Link>} icon="shield" />
        <KpiCard label="Plugins in review" value={stats.appsInReview} hint={<Link href="/admin/apps" className="font-semibold text-teal-700">Review</Link>} icon="layers" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="font-semibold">Stores by plan</h2>
          <BarChart values={stats.byPlan.map((p) => p.stores)} labels={stats.byPlan.map((p) => p.plan)} label="Stores by plan" /></Card>
        <Card><h2 className="p-5 pb-3 font-semibold">Database</h2>
          <Table><thead><tr><Th>Collection</Th><Th right>Documents</Th></tr></thead>
            <tbody>{dbh.collections.map(([n, c]) => <tr key={n}><Td mono>{n}</Td><Td right>{c}</Td></tr>)}</tbody></Table>
          <div className="flex items-center gap-3 p-4 text-xs text-muted"><StatusPill tone={dbh.ok ? "ok" : "bad"}>{dbh.ok ? "MongoDB connected" : "MongoDB error"}</StatusPill><span className="font-mono">ping {dbh.pingMs} ms · db {dbh.name}</span></div>
        </Card>
      </div>
      <Card><h2 className="p-5 pb-3 font-semibold">Newest stores</h2>
        <Table><thead><tr><Th>Store</Th><Th>Plan</Th><Th>Status</Th></tr></thead>
          <tbody>{recent.map((s) => <tr key={s.id}><Td><Link href={`/admin/stores/${s.id}`} className="font-medium text-teal-700">{s.name}</Link><div className="font-mono text-xs text-muted">{s.slug}.ind2b.com</div></Td><Td className="capitalize">{s.plan}</Td><Td><StatusPill tone={s.status === "active" ? "ok" : s.status === "setup" ? "warn" : "bad"}>{s.status}</StatusPill></Td></tr>)}</tbody></Table>
      </Card>
      <Card><h2 className="p-5 pb-3 font-semibold">Audit log</h2>
        <Table><thead><tr><Th>When</Th><Th>Admin</Th><Th>Action</Th><Th>Target</Th></tr></thead>
          <tbody>{log.map((l) => <tr key={l.id}><Td className="whitespace-nowrap text-muted">{new Date(l.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Td><Td>{l.actorName}</Td><Td mono>{l.action}</Td><Td mono>{l.target}</Td></tr>)}
            {log.length === 0 && <tr><Td colSpan={4} className="py-8 text-center text-muted">No admin actions yet.</Td></tr>}</tbody></Table>
      </Card>
    </div>
  );
}
