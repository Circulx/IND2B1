import { getUser, listSessions } from "@/lib/services";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { ActionButton, CardHead, fmtDateTime, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { PasswordForm, ProfileForm } from "@/components/dashboard/account-forms";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { signOutMyDeviceAction, signOutMyOtherDevicesAction } from "@/actions/superadmin-portal";

export const metadata = { title: "My account" };

/** The signed-in super admin's own profile, password and devices. */
export default async function MyAccount({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [session, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const [user, sessions] = await Promise.all([getUser(session.userId), listSessions(session.userId)]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="My account" subtitle={<span className="break-all">{session.email} · super admin</span>} />
      <Flash sp={sp} />
      <div className="grid-cols-1 grid gap-5 lg:grid-cols-2">
        <ProfileForm name={user?.name ?? ""} phone={user?.phone ?? ""} />
        <PasswordForm strong />
      </div>
      <Card>
        <CardHead title="My signed-in devices" sub="Sign out any device you don't recognise, then change your password."
          action={sessions.length > 1 ? <ActionButton action={signOutMyOtherDevicesAction} fields={{}} label="Sign out all other devices" /> : undefined} />
        <Table>
          <thead><tr><Th>Device</Th><Th className={hideBelow.sm}>IP address</Th><Th className={hideBelow.md}>Signed in</Th><Th className={hideBelow.md}>Last active</Th><Th /></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sid}>
                <Td className="max-w-[300px] text-xs text-muted"><div className="line-clamp-2 break-all">{s.userAgent || "Unknown browser"}</div><div className="mt-0.5 md:hidden">{fmtDateTime(s.lastSeenAt)}</div></Td>
                <Td mono className={hideBelow.sm}>{s.ip || "—"}</Td>
                <Td className={`whitespace-nowrap ${hideBelow.md}`}>{fmtDateTime(s.createdAt)}</Td>
                <Td className={`whitespace-nowrap ${hideBelow.md}`}>{fmtDateTime(s.lastSeenAt)}</Td>
                <Td right>{s.sid === session.sid ? <span className="font-sans text-xs font-semibold text-ok">This device</span>
                  : <ActionButton action={signOutMyDeviceAction} fields={{ sid: s.sid }} label="Sign out" link="bad" />}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
