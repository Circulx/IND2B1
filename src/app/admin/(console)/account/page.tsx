import { getUser, listSessions } from "@/lib/services";
import { Button, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { signOutDevice, signOutOtherDevices } from "@/actions/account";
import { PasswordForm, ProfileForm } from "@/components/dashboard/account-forms";

export const metadata = { title: "Account & security" };

export default async function Account() {
  const session = await requireAdmin();
  const [user, sessions] = await Promise.all([getUser(session.userId), listSessions(session.userId)]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account & security" subtitle={session.email} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileForm name={user?.name ?? ""} phone={user?.phone ?? ""} />
        <PasswordForm />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div><h2 className="font-semibold">Signed-in devices</h2><p className="text-sm text-muted">Sign out any device you don&apos;t recognise, then change your password.</p></div>
          {sessions.length > 1 && <form action={signOutOtherDevices}><Button size="sm" variant="secondary">Sign out all other devices</Button></form>}
        </div>
        <Table>
          <thead><tr><Th>Device</Th><Th>IP address</Th><Th>Signed in</Th><Th>Last active</Th><Th /></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sid}>
                <Td className="max-w-[340px] truncate text-muted" >{s.userAgent || "Unknown browser"}</Td>
                <Td mono>{s.ip || "—"}</Td>
                <Td className="whitespace-nowrap">{new Date(s.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Td>
                <Td className="whitespace-nowrap">{new Date(s.lastSeenAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Td>
                <Td right>{s.sid === session.sid
                  ? <span className="font-sans text-xs font-semibold text-ok">This device</span>
                  : <form action={signOutDevice.bind(null, s.sid)}><button className="font-sans text-[13px] font-semibold text-bad">Sign out</button></form>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
