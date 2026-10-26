import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { countActiveSuperAdmins, getUser, listSessions, listStoresForOwner } from "@/lib/services";
import { Banner, Button, Card, PageHeader, StatusPill, Table, Td, Th } from "@/components/ui";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { SetPasswordForm } from "@/components/admin/user-forms";
import { ROLE_LABEL } from "@/components/admin/roles";
import { requireSuperAdmin } from "@/lib/admin";
import { changeStaffRoleAction, revokeOneSessionAction, revokeUserSessionsAction, setUserStatusAction } from "@/actions/superadmin";

export const metadata = { title: "User" };

const MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  "ok:role": { tone: "ok", text: "Role changed. The user was signed out and gets the new role when they sign in again." },
  "ok:disabled": { tone: "ok", text: "Account disabled and signed out of every device." },
  "ok:active": { tone: "ok", text: "Account enabled. The user can sign in again." },
  "ok:signedout": { tone: "ok", text: "Signed out of every device." },
  "error:self": { tone: "warn", text: "You cannot change your own role or disable yourself. Ask another super admin." },
  "error:last_superadmin": { tone: "warn", text: "This is the last active super admin. Add another super admin first." },
  "error:not_staff": { tone: "warn", text: "Merchant accounts cannot be turned into staff. Create a separate staff account." },
  "error:not_found": { tone: "warn", text: "That account no longer exists." },
  "error:failed": { tone: "warn", text: "Something went wrong. Please try again." },
};

/** Super admin: one platform account, with full control over it. */
export default async function UserDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [session, { id }, sp] = await Promise.all([requireSuperAdmin(), params, searchParams]);
  const user = await getUser(id);
  if (!user) notFound();
  const [sessions, stores, superCount] = await Promise.all([listSessions(user.id), user.role === "merchant" ? listStoresForOwner(user.id) : Promise.resolve([]), countActiveSuperAdmins()]);
  const self = user.id === session.userId;
  const msg = sp.ok ? MESSAGES[`ok:${sp.ok}`] : sp.error ? MESSAGES[`error:${sp.error}`] : undefined;
  const lastSuper = user.role === "superadmin" && user.status === "active" && superCount <= 1;
  const rows: [string, React.ReactNode][] = [
    ["User ID", <span key="i" className="font-mono">{user.id}</span>], ["Email", user.email], ["Phone", user.phone || "—"],
    ["Role", <StatusPill key="r" tone={ROLE_LABEL[user.role].tone} dot={false}>{ROLE_LABEL[user.role].label}</StatusPill>],
    ["Status", <StatusPill key="s" tone={user.status === "active" ? "ok" : "bad"}>{user.status === "active" ? "Active" : "Disabled"}</StatusPill>],
    ["Created", new Date(user.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
    ["Last sign-in", user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={<Link href="/admin/users" className="text-teal-700">← Users & staff</Link>} title={<span className="flex items-center gap-3">{user.name}{self && <span className="text-base font-normal text-muted">(you)</span>}</span>} />
      {msg && <Banner tone={msg.tone} icon={msg.tone === "ok" ? "check-circle" : "alert"}>{msg.text}</Banner>}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card className="p-5"><dl className="grid grid-cols-[140px_1fr] gap-y-2.5 text-sm">{rows.map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></Fragment>)}</dl></Card>

          {user.role === "merchant" && (
            <Card>
              <h2 className="p-5 pb-3 font-semibold">Stores ({stores.length})</h2>
              <Table><thead><tr><Th>Store</Th><Th>Plan</Th><Th>Status</Th></tr></thead>
                <tbody>{stores.map((s) => <tr key={s.id}><Td><Link href={`/admin/stores/${s.id}`} className="font-medium text-teal-700">{s.name}</Link><div className="font-mono text-xs text-muted">{s.slug}</div></Td><Td className="capitalize">{s.plan}</Td><Td className="capitalize">{s.status}</Td></tr>)}
                  {stores.length === 0 && <tr><Td colSpan={3} className="py-6 text-center text-muted">No stores yet.</Td></tr>}</tbody></Table>
            </Card>
          )}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
              <h2 className="font-semibold">Signed-in devices ({sessions.length})</h2>
              {sessions.length > 0 && (
                <form action={revokeUserSessionsAction.bind(null, user.id)}>
                  <ConfirmSubmit message={`Sign ${user.name} out of ${self ? "every other device" : "every device"}?`}><Button size="sm" variant="secondary">{self ? "Sign out other devices" : "Sign out everywhere"}</Button></ConfirmSubmit>
                </form>
              )}
            </div>
            <Table>
              <thead><tr><Th>Device</Th><Th>IP address</Th><Th>Last active</Th><Th /></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.sid}>
                    <Td className="max-w-[300px] truncate text-muted">{s.userAgent || "Unknown browser"}</Td>
                    <Td mono>{s.ip || "—"}</Td>
                    <Td className="whitespace-nowrap">{new Date(s.lastSeenAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Td>
                    <Td right>{s.sid === session.sid ? <span className="font-sans text-xs font-semibold text-ok">This device</span>
                      : <form action={revokeOneSessionAction.bind(null, user.id, s.sid)}><button className="font-sans text-[13px] font-semibold text-bad">Sign out</button></form>}</Td>
                  </tr>
                ))}
                {sessions.length === 0 && <tr><Td colSpan={4} className="py-6 text-center text-muted">Not signed in anywhere.</Td></tr>}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {user.role !== "merchant" && (
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="font-semibold">Staff role</h2>
              <p className="text-sm text-muted">Super admins have complete control: users, staff, plans, shopper accounts and the audit log. Admins handle KYC, stores and plugins.</p>
              {self ? <p className="text-sm text-muted">You cannot change your own role.</p>
                : lastSuper ? <p className="text-sm text-warn">This is the last active super admin, so the role cannot be changed.</p>
                : (
                  <form action={changeStaffRoleAction.bind(null, user.id, user.role === "superadmin" ? "admin" : "superadmin")}>
                    <ConfirmSubmit message={user.role === "superadmin" ? `Make ${user.name} an admin? They lose super admin access.` : `Give ${user.name} complete control as a super admin?`}>
                      <Button size="sm" variant="secondary">{user.role === "superadmin" ? "Change to admin" : "Promote to super admin"}</Button>
                    </ConfirmSubmit>
                  </form>
                )}
            </Card>
          )}

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-semibold">{user.status === "active" ? "Disable account" : "Enable account"}</h2>
            <p className="text-sm text-muted">{user.status === "active"
              ? user.role === "merchant" ? "Blocks sign-in and ends every session. Their stores stay online; suspend a store separately under Stores." : "Blocks sign-in and ends every session."
              : "The user can sign in again with their password."}</p>
            {self ? <p className="text-sm text-muted">You cannot disable yourself.</p>
              : lastSuper ? <p className="text-sm text-warn">The last active super admin cannot be disabled.</p>
              : (
                <form action={setUserStatusAction.bind(null, user.id, user.status === "active" ? "disabled" : "active")}>
                  <ConfirmSubmit message={user.status === "active" ? `Disable ${user.email}?` : `Enable ${user.email}?`}>
                    <Button size="sm" variant={user.status === "active" ? "danger" : "primary"}>{user.status === "active" ? "Disable account" : "Enable account"}</Button>
                  </ConfirmSubmit>
                </form>
              )}
          </Card>

          {!self && <SetPasswordForm userId={user.id} strong={user.role !== "merchant"} />}
        </div>
      </div>
    </div>
  );
}
