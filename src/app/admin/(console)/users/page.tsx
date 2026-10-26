import Link from "next/link";
import { countActiveSessions, listUsers, storeCountsByOwner } from "@/lib/services";
import { ROLE_LABEL } from "@/components/admin/roles";
import { Card, PageHeader, SearchInput, StatusPill, Table, Tabs, Td, Th } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/admin";
import { CreateStaffForm } from "@/components/admin/user-forms";

export const metadata = { title: "Users & staff" };

const TABS = [["all", "All"], ["merchant", "Merchants"], ["admin", "Admins"], ["superadmin", "Super admins"], ["disabled", "Disabled"]] as const;

/** Super admin: every platform account (store owners and staff). */
export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const [session, { q = "", tab = "all" }] = await Promise.all([requireSuperAdmin(), searchParams]);
  const role = tab === "merchant" || tab === "admin" || tab === "superadmin" ? tab : undefined;
  const users = await listUsers(500, { q, role, status: tab === "disabled" ? "disabled" : undefined });
  const [devices, stores] = await Promise.all([countActiveSessions(users.map((u) => u.id)), storeCountsByOwner(users.map((u) => u.id))]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Users & staff" subtitle="Store owners and the IND2B team. Open a user to change their role, disable them, sign them out or set a password." />
      <Tabs items={TABS.map(([k, label]) => ({ label, href: `/admin/users${k === "all" ? "" : `?tab=${k}`}`, active: tab === k }))} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <form className="max-w-md"><input type="hidden" name="tab" value={tab} /><SearchInput placeholder="Search name, email or user ID" defaultValue={q} /></form>
          <Card>
            <Table>
              <thead><tr><Th>User</Th><Th>Role</Th><Th>Status</Th><Th right>Stores</Th><Th right>Devices</Th><Th>Last sign-in</Th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-subtle">
                    <Td><Link href={`/admin/users/${u.id}`} className="font-medium text-teal-700">{u.name}</Link>{u.id === session.userId && <span className="ml-1.5 text-xs text-muted">(you)</span>}<div className="text-xs text-muted">{u.email}</div></Td>
                    <Td><StatusPill tone={ROLE_LABEL[u.role].tone} dot={false}>{ROLE_LABEL[u.role].label}</StatusPill></Td>
                    <Td><StatusPill tone={u.status === "active" ? "ok" : "bad"}>{u.status === "active" ? "Active" : "Disabled"}</StatusPill></Td>
                    <Td right>{u.role === "merchant" ? stores.get(u.id) ?? 0 : "—"}</Td>
                    <Td right>{devices.get(u.id) ?? 0}</Td>
                    <Td className="whitespace-nowrap text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</Td>
                  </tr>
                ))}
                {users.length === 0 && <tr><Td colSpan={6} className="py-10 text-center text-muted">No users match.</Td></tr>}
              </tbody>
            </Table>
          </Card>
        </div>
        <CreateStaffForm />
      </div>
    </div>
  );
}
