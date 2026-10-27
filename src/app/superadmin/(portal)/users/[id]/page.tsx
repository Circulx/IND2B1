import Link from "next/link";
import { notFound } from "next/navigation";
import { countActiveSuperAdmins, getUser, listSessions, listStoresForOwner } from "@/lib/services";
import { ROLE_LABEL } from "@/components/admin/roles";
import { Card, PageHeader, StatusPill, Table, Td, Th } from "@/components/ui";
import { ActionButton, CardHead, DetailList, Empty, STORE_TONE, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { EditAccountForm, SetPasswordForm } from "@/components/superadmin/forms";
import { Flash } from "@/components/superadmin/flash";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { accountControlAction, revokeUserDeviceAction } from "@/actions/superadmin-portal";

export const metadata = { title: "Account" };

/** One platform account with complete control over it. */
export default async function UserControl({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [session, { id }, sp] = await Promise.all([requireSuperAdminPortal(), params, searchParams]);
  const user = await getUser(id);
  if (!user) notFound();
  const [sessions, stores, superCount] = await Promise.all([listSessions(user.id), user.role === "merchant" ? listStoresForOwner(user.id) : Promise.resolve([]), countActiveSuperAdmins()]);
  const self = user.id === session.userId;
  const lastSuper = user.role === "superadmin" && user.status === "active" && superCount <= 1;
  const here = `/superadmin/users/${user.id}`;
  const f = (op: string) => ({ userId: user.id, op, back: here });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={<Link href="/superadmin/users" className="text-teal-700">← Users & staff</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{user.name}{self && <span className="text-base font-normal text-muted">(you)</span>}<StatusPill tone={ROLE_LABEL[user.role].tone} dot={false}>{ROLE_LABEL[user.role].label}</StatusPill></span>}
        subtitle={<span className="break-all">{user.email}</span>} />
      <Flash sp={sp} />

      <div className="grid-cols-1 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="p-4 sm:p-5">
            <DetailList rows={[
              ["User ID", <span key="i" className="font-mono">{user.id}</span>],
              ["Phone", user.phone || "—"],
              ["Status", <StatusPill key="s" tone={user.status === "active" ? "ok" : "bad"}>{user.status === "active" ? "Active" : "Disabled"}</StatusPill>],
              ["Created", fmtDateTime(user.createdAt)],
              ["Last sign-in", fmtDateTime(user.lastLoginAt)],
              ["Signs in at", user.role === "merchant" ? "/login" : user.role === "admin" ? "/admin/login" : "/superadmin/login or /admin/login"],
            ]} />
          </Card>

          <EditAccountForm userId={user.id} name={user.name} email={user.email} phone={user.phone} />

          {user.role === "merchant" && (
            <Card>
              <CardHead title={`Stores (${stores.length})`} sub={stores.length ? "Transfer or delete these before deleting the account." : undefined} />
              <Table>
                <thead><tr><Th>Store</Th><Th className={hideBelow.sm}>Plan</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.id} className="hover:bg-subtle">
                      <Td><Link href={`/superadmin/stores/${s.id}`} className="font-medium text-teal-700">{s.name}</Link><div className="font-mono text-xs text-muted">{s.slug}</div></Td>
                      <Td className={`capitalize ${hideBelow.sm}`}>{s.plan}</Td>
                      <Td><StatusPill tone={STORE_TONE[s.status]!}>{s.status}</StatusPill></Td>
                    </tr>
                  ))}
                  {stores.length === 0 && <Empty colSpan={3}>No stores.</Empty>}
                </tbody>
              </Table>
            </Card>
          )}

          <Card>
            <CardHead title={`Signed-in devices (${sessions.length})`} action={sessions.length > 0 ? (
              <ActionButton action={accountControlAction} fields={f("signout")} label={self ? "Sign out other devices" : "Sign out everywhere"} confirm={`Sign ${user.name} out of ${self ? "every other device" : "every device"}?`} />
            ) : undefined} />
            <Table>
              <thead><tr><Th>Device</Th><Th className={hideBelow.sm}>IP address</Th><Th className={hideBelow.md}>Last active</Th><Th /></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.sid}>
                    <Td className="max-w-[260px] text-xs text-muted"><div className="line-clamp-2 break-all">{s.userAgent || "Unknown browser"}</div><div className="mt-0.5 md:hidden">{fmtDateTime(s.lastSeenAt)}</div></Td>
                    <Td mono className={hideBelow.sm}>{s.ip || "—"}</Td>
                    <Td className={`whitespace-nowrap ${hideBelow.md}`}>{fmtDateTime(s.lastSeenAt)}</Td>
                    <Td right>{s.sid === session.sid ? <span className="font-sans text-xs font-semibold text-ok">This device</span>
                      : <ActionButton action={revokeUserDeviceAction} fields={{ userId: user.id, sid: s.sid, back: here }} label="Sign out" link="bad" />}</Td>
                  </tr>
                ))}
                {sessions.length === 0 && <Empty colSpan={4}>Not signed in anywhere.</Empty>}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {user.role !== "merchant" && (
            <Card className="flex flex-col gap-3 p-4 sm:p-5">
              <h2 className="font-semibold">Staff role</h2>
              <p className="text-sm text-muted">Super admins have complete control. Admins handle KYC, stores and plugins in /admin.</p>
              {self ? <p className="text-sm text-muted">You cannot change your own role.</p>
                : lastSuper ? <p className="text-sm text-warn">This is the last active super admin, so the role cannot be changed.</p>
                : user.role === "superadmin"
                  ? <ActionButton action={accountControlAction} fields={f("make_admin")} label="Change to admin" confirm={`Make ${user.name} an admin? They lose super admin access.`} className="self-start" />
                  : <ActionButton action={accountControlAction} fields={f("make_superadmin")} label="Promote to super admin" confirm={`Give ${user.name} complete control as a super admin?`} className="self-start" />}
            </Card>
          )}

          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="font-semibold">{user.status === "active" ? "Disable account" : "Enable account"}</h2>
            <p className="text-sm text-muted">{user.status === "active"
              ? user.role === "merchant" ? "Blocks sign-in and ends every session. Their stores stay online; suspend stores separately." : "Blocks sign-in and ends every session."
              : "The user can sign in again with their password."}</p>
            {self ? <p className="text-sm text-muted">You cannot disable yourself.</p>
              : lastSuper ? <p className="text-sm text-warn">The last active super admin cannot be disabled.</p>
              : <ActionButton action={accountControlAction} fields={f(user.status === "active" ? "disable" : "enable")} label={user.status === "active" ? "Disable account" : "Enable account"}
                  variant={user.status === "active" ? "danger" : "primary"} confirm={`${user.status === "active" ? "Disable" : "Enable"} ${user.email}?`} className="self-start" />}
          </Card>

          {!self && <SetPasswordForm userId={user.id} strong={user.role !== "merchant"} />}

          <Card className="flex flex-col gap-3 border-[#e6b8b3] p-4 sm:p-5">
            <h2 className="font-semibold text-bad">Delete account</h2>
            <p className="text-sm text-muted">Removes the account and signs it out. Audit entries keep the name. {user.role === "merchant" && "Only possible once the merchant owns no stores."}</p>
            {self ? <p className="text-sm text-muted">You cannot delete yourself.</p>
              : lastSuper ? <p className="text-sm text-warn">The last active super admin cannot be deleted.</p>
              : stores.length > 0 ? <p className="text-sm text-warn">Owns {stores.length} store{stores.length === 1 ? "" : "s"}. Transfer or delete them first.</p>
              : <ActionButton action={accountControlAction} fields={f("delete")} label="Delete account" variant="danger" icon="trash" confirm={`Permanently delete ${user.email}? This cannot be undone.`} className="self-start" />}
          </Card>
        </div>
      </div>
    </div>
  );
}
