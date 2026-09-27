import { listAllStores } from "@/lib/services";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { KYC_KINDS } from "@/lib/kyc";
import { decideKyc } from "@/actions/admin";

export const metadata = { title: "KYC queue" };

export default async function Kyc() {
  await requireAdmin();
  const queue = (await listAllStores()).filter((s) => s.kyc === "pending");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="KYC queue" subtitle="Verify PAN, bank account and GSTIN before payouts start." />
      {queue.length === 0 && <Card className="p-10 text-center text-muted">Nothing waiting. Good work.</Card>}
      {queue.map((s) => (
        <Card key={s.id} className="grid gap-5 p-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-1.5 text-sm">
            <h2 className="text-lg font-semibold">{s.name}</h2>
            <span className="font-mono text-xs text-muted">{s.id} · {s.slug}.ind2b.com</span>
            <span>{s.settings.email} · {s.settings.phone || "no phone"}</span>
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
            <span className="text-xs text-muted">Downloads are recorded in the audit log.</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <form action={decideKyc}><input type="hidden" name="storeId" value={s.id} /><input type="hidden" name="decision" value="approve" /><Button className="w-full">Approve</Button></form>
            <form action={decideKyc} className="flex gap-2">
              <input type="hidden" name="storeId" value={s.id} /><input type="hidden" name="decision" value="reject" />
              <Input name="note" required placeholder="Reason for rejection" aria-label={`Rejection reason for ${s.name}`} />
              <Button variant="danger">Reject</Button>
            </form>
          </div>
        </Card>
      ))}
    </div>
  );
}
