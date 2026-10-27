import Link from "next/link";
import { listAllStores } from "@/lib/services";
import { Button, Card, Input, PageHeader, StatusPill, Table, Tabs, Td, Th } from "@/components/ui";
import { ActionButton, Empty, KYC_TONE, hideBelow } from "@/components/superadmin/bits";
import { Flash } from "@/components/superadmin/flash";
import { KYC_KINDS } from "@/lib/kyc";
import { requireSuperAdminPortal } from "@/lib/superadmin";
import { decideStoreKycAction } from "@/actions/superadmin-portal";

export const metadata = { title: "KYC verification" };

const TABS = [["pending", "Waiting"], ["verified", "Verified"], ["rejected", "Rejected"], ["not_started", "Not started"]] as const;

/** KYC queue plus every store's KYC state; approve, reject or reset any of them. */
export default async function Kyc({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; error?: string }> }) {
  const [, sp] = await Promise.all([requireSuperAdminPortal(), searchParams]);
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "pending";
  const stores = await listAllStores();
  const list = stores.filter((s) => s.kyc === tab);
  const back = `/superadmin/kyc?tab=${tab}`;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="KYC verification" subtitle="Check PAN, bank proof and GSTIN before payouts start. Document downloads are recorded in the audit log." />
      <Flash sp={sp} />
      <Tabs items={TABS.map(([k, label]) => ({ label, href: `/superadmin/kyc?tab=${k}`, active: tab === k, count: stores.filter((s) => s.kyc === k).length }))} />
      {tab === "pending" ? (
        <div className="flex flex-col gap-4">
          {list.length === 0 && <Card className="p-10 text-center text-muted">Nothing waiting. Good work.</Card>}
          {list.map((s) => (
            <Card key={s.id} className="grid-cols-1 grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.2fr_1fr]">
              <div className="flex min-w-0 flex-col gap-1.5 text-sm">
                <Link href={`/superadmin/stores/${s.id}`} className="text-lg font-semibold text-teal-700">{s.name}</Link>
                <span className="break-all font-mono text-xs text-muted">{s.id} · {s.slug}.ind2b.com</span>
                <span className="break-words">{s.settings.email} · {s.settings.phone || "no phone"}</span>
                <span>{s.settings.address || "No address"}, {s.settings.state}</span>
                <span>GSTIN: <span className="font-mono">{s.settings.gstin ?? "not registered"}</span></span>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {(s.kycDocs ?? []).map((d) => (
                    <a key={d.fileId} href={`/api/kyc/${d.fileId}`} className="rounded-control border border-line px-2.5 py-1.5 font-semibold text-teal-700 hover:bg-teal-50">
                      {KYC_KINDS[d.kind]} · {d.contentType === "application/pdf" ? "PDF" : "Image"} · {(d.size / 1024).toFixed(0)} KB ↓
                    </a>
                  ))}
                  {(s.kycDocs ?? []).length === 0 && <span className="text-bad">No documents uploaded</span>}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <ActionButton action={decideStoreKycAction} fields={{ storeId: s.id, decision: "approve", back }} label="Approve" variant="primary" size="md" className="w-full" />
                <form action={decideStoreKycAction} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="storeId" value={s.id} /><input type="hidden" name="decision" value="reject" /><input type="hidden" name="back" value={back} />
                  <Input name="note" required placeholder="Reason for rejection" aria-label={`Rejection reason for ${s.name}`} />
                  <Button variant="danger">Reject</Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <thead><tr><Th>Store</Th><Th className={hideBelow.md}>Email</Th><Th className={hideBelow.sm}>KYC</Th><Th className={hideBelow.lg}>Note</Th><Th right>Actions</Th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="hover:bg-subtle">
                  <Td><Link href={`/superadmin/stores/${s.id}`} className="font-medium text-teal-700">{s.name}</Link><div className="font-mono text-xs text-muted">{s.slug}</div></Td>
                  <Td className={`text-muted ${hideBelow.md}`}>{s.settings.email}</Td>
                  <Td className={hideBelow.sm}><StatusPill tone={KYC_TONE[s.kyc]!}>{s.kyc.replace("_", " ")}</StatusPill></Td>
                  <Td className={`max-w-[280px] text-xs text-muted ${hideBelow.lg}`}>{s.kycNote || "—"}</Td>
                  <Td right>
                    <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-4">
                      {s.kyc !== "verified" && <ActionButton action={decideStoreKycAction} fields={{ storeId: s.id, decision: "approve", back }} label="Approve" link="teal" confirm={`Mark ${s.name} as KYC verified?`} />}
                      {s.kyc !== "not_started" && <ActionButton action={decideStoreKycAction} fields={{ storeId: s.id, decision: "reset", back }} label="Reset" link="bad" confirm={`Reset KYC for ${s.name}?`} />}
                    </div>
                  </Td>
                </tr>
              ))}
              {list.length === 0 && <Empty colSpan={5}>No stores here.</Empty>}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
