import Link from "next/link";
import { listActiveSessionsAll } from "@/lib/services/platform";
import { Card, PageHeader, StatusPill, Table, Tabs, Td, Th } from "@/components/ui";
import { ROLE_LABEL } from "@/components/admin/roles";
import { ActionButton, CardHead, Empty, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { revokeScopeAction, revokeSessionAction } from "@/actions/superadmin-portal";
import type { Role } from "@/lib/types";

export const metadata = { title: "Active sessions" };

/** Every signed-in device on the platform, with per-device and emergency group sign-out. */
export default async function Sessions({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; error?: string }> }) {
  const [me, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const tab = sp.tab === "shoppers" ? "shoppers" : "platform";
  const rows = await listActiveSessionsAll(tab === "shoppers" ? "customer" : "platform");
  const back = `/superadmin/sessions${tab === "shoppers" ? "?tab=shoppers" : ""}`;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Active sessions" subtitle="Signed-in devices, most recently active first (latest 500). Ending a session signs that device out immediately." />
      <Flash sp={sp} />
      <Card>
        <CardHead title="Emergency sign-out" sub="Use after a leaked password or a security incident. Your own device always stays signed in." />
        <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
          <ActionButton action={revokeScopeAction} fields={{ scope: "merchants", back }} label="Sign out all merchants" confirm="Sign every merchant out of every device?" />
          <ActionButton action={revokeScopeAction} fields={{ scope: "staff", back }} label="Sign out all other staff" confirm="Sign every other admin and super admin out?" />
          <ActionButton action={revokeScopeAction} fields={{ scope: "shoppers", back }} label="Sign out all shoppers" confirm="Sign every shopper out of every store?" />
          <ActionButton action={revokeScopeAction} fields={{ scope: "everyone", back }} label="Sign out everyone" variant="danger" icon="alert" confirm="Sign EVERYONE except you out of IND2B?" />
        </div>
      </Card>
      <Tabs items={[{ label: "Merchants & staff", href: "/superadmin/sessions", active: tab === "platform" }, { label: "Shoppers", href: "/superadmin/sessions?tab=shoppers", active: tab === "shoppers" }]} />
      <Card>
        <Table>
          <thead><tr><Th>Who</Th><Th className={hideBelow.sm}>{tab === "shoppers" ? "Store" : "Role"}</Th><Th className={hideBelow.lg}>Device</Th><Th className={hideBelow.md}>IP</Th><Th className={hideBelow.md}>Last active</Th><Th right /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sid} className="hover:bg-subtle">
                <Td>
                  {tab === "platform" ? <Link href={`/superadmin/users/${r.userId}`} className="font-medium text-teal-700">{r.name}</Link> : <span className="font-medium">{r.name}</span>}
                  <div className="break-all text-xs text-muted">{r.email}</div>
                  <div className="text-xs text-muted md:hidden">{fmtDateTime(r.lastSeenAt)}{r.ip ? ` · ${r.ip}` : ""}</div>
                </Td>
                <Td className={hideBelow.sm}>{tab === "shoppers" ? r.storeName : r.role in ROLE_LABEL ? <StatusPill tone={ROLE_LABEL[r.role as Role].tone} dot={false}>{ROLE_LABEL[r.role as Role].label}</StatusPill> : r.role}</Td>
                <Td className={`max-w-[280px] text-xs text-muted ${hideBelow.lg}`}><div className="line-clamp-2 break-all">{r.userAgent || "Unknown browser"}</div></Td>
                <Td mono className={hideBelow.md}>{r.ip || "—"}</Td>
                <Td className={`whitespace-nowrap ${hideBelow.md}`}>{fmtDateTime(r.lastSeenAt)}</Td>
                <Td right>{r.sid === me.sid ? <span className="font-sans text-xs font-semibold text-ok">This device</span>
                  : <ActionButton action={revokeSessionAction} fields={{ sid: r.sid, userId: r.userId, back }} label="End" link="bad" />}</Td>
              </tr>
            ))}
            {rows.length === 0 && <Empty colSpan={6}>No active sessions.</Empty>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
