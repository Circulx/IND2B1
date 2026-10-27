import Link from "next/link";
import { countActiveSessions, listUsers, storeCountsByOwner } from "@/lib/services";
import { ROLE_LABEL } from "@/components/admin/roles";
import { Card, PageHeader, StatusPill, Table, Tabs, Td, Th } from "@/components/ui";
import { Empty, FilterBar, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { CreateAccountForm } from "@/components/superadmin/forms";
import { Flash } from "@/components/superadmin/flash";
import { requireSuperAdminPortal } from "@/lib/superadmin";

export const metadata = { title: "Users & staff" };

const TABS = [["all", "All"], ["merchant", "Merchants"], ["admin", "Admins"], ["superadmin", "Super admins"], ["disabled", "Disabled"]] as const;

/** Every platform account: store owners and the IND2B team. */
export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string; ok?: string; error?: string }> }) {
  const [session, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "all";
  const role = tab === "merchant" || tab === "admin" || tab === "superadmin" ? tab : undefined;
  const users = await listUsers(500, { q: sp.q, role, status: tab === "disabled" ? "disabled" : undefined });
  const [devices, stores] = await Promise.all([countActiveSessions(users.map((u) => u.id)), storeCountsByOwner(users.map((u) => u.id))]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Users & staff" subtitle="Open an account to edit it, change its role, disable it, sign it out, set a password or delete it." />
      <Flash sp={sp} />
      <Tabs items={TABS.map(([k, label]) => ({ label, href: `/superadmin/users${k === "all" ? "" : `?tab=${k}`}`, active: tab === k }))} />
      <div className="grid-cols-1 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <FilterBar q={sp.q} placeholder="Search name, email or user ID" hidden={tab === "all" ? {} : { tab }} clearHref={`/superadmin/users${tab === "all" ? "" : `?tab=${tab}`}`} />
          <Card>
            <Table>
              <thead><tr><Th>Account</Th><Th>Role</Th><Th className={hideBelow.sm}>Status</Th><Th right className={hideBelow.md}>Stores</Th><Th right className={hideBelow.md}>Devices</Th><Th className={hideBelow.lg}>Last sign-in</Th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-subtle">
                    <Td>
                      <Link href={`/superadmin/users/${u.id}`} className="font-medium text-teal-700">{u.name}</Link>{u.id === session.userId && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                      <div className="break-all text-xs text-muted">{u.email}</div>
                      {u.status === "disabled" && <div className="mt-1 sm:hidden"><StatusPill tone="bad">Disabled</StatusPill></div>}
                    </Td>
                    <Td><StatusPill tone={ROLE_LABEL[u.role].tone} dot={false}>{ROLE_LABEL[u.role].label}</StatusPill></Td>
                    <Td className={hideBelow.sm}><StatusPill tone={u.status === "active" ? "ok" : "bad"}>{u.status === "active" ? "Active" : "Disabled"}</StatusPill></Td>
                    <Td right className={hideBelow.md}>{u.role === "merchant" ? stores.get(u.id) ?? 0 : "—"}</Td>
                    <Td right className={hideBelow.md}>{devices.get(u.id) ?? 0}</Td>
                    <Td className={`whitespace-nowrap text-muted ${hideBelow.lg}`}>{fmtDateTime(u.lastLoginAt)}</Td>
                  </tr>
                ))}
                {users.length === 0 && <Empty colSpan={6}>No accounts match.</Empty>}
              </tbody>
            </Table>
          </Card>
        </div>
        <div id="create" className="scroll-mt-20"><CreateAccountForm /></div>
      </div>
    </div>
  );
}
