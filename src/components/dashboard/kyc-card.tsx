"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Card, Icon, StatusPill } from "@/components/ui";
import type { KycDoc, Store } from "@/lib/types";

const KINDS = [["pan", "PAN card"], ["bank", "Cancelled cheque or bank statement"], ["gst", "GST certificate"]] as const;
const STATUS = { not_started: { label: "Not started", tone: "neutral" }, pending: { label: "Under review", tone: "warn" }, verified: { label: "Verified", tone: "ok" }, rejected: { label: "Rejected", tone: "bad" } } as const;

/** KYC: upload three private documents, then submit for review. Files go to POST /api/kyc (stored in MongoDB, never public). */
export function KycCard({ kyc, note, docs, submitAction, missing }: { kyc: Store["kyc"]; note?: string; docs: KycDoc[]; submitAction: () => Promise<void>; missing?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const editable = kyc === "not_started" || kyc === "rejected";

  async function upload(kind: string, file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Files must be 5 MB or smaller."); return; }
    setBusy(kind); setError(null);
    const fd = new FormData(); fd.append("kind", kind); fd.append("file", file);
    const res = await fetch("/api/kyc", { method: "POST", body: fd, credentials: "same-origin" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) setError(json.error ?? "Upload failed.");
    setBusy(null);
    if (inputs.current[kind]) inputs.current[kind]!.value = "";
    router.refresh();
  }

  const have = new Map(docs.map((d) => [d.kind, d]));
  return (
    <Card className="flex flex-col gap-4 p-5" id="kyc">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1"><h2 className="font-semibold">Business verification (KYC)</h2>
          <p className="text-sm text-muted">Needed before payouts start. Documents are stored privately and only the IND2B verification team can open them.</p></div>
        <StatusPill tone={STATUS[kyc].tone}>{STATUS[kyc].label}</StatusPill>
      </div>
      {kyc === "rejected" && note && <p className="rounded-control bg-bad-50 p-3 text-sm text-bad">Reason: {note}</p>}
      <ul className="flex flex-col divide-y divide-line-soft rounded-control border border-line">
        {KINDS.map(([kind, label]) => {
          const d = have.get(kind);
          return (
            <li key={kind} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Icon name={d ? "check-circle" : "file"} size={18} className={d ? "text-ok" : "text-muted"} />
              <span className="flex-1">{label}{d && <span className="block text-xs text-muted">{d.filename} · {(d.size / 1024).toFixed(0)} KB · <a href={`/api/kyc/${d.fileId}`} className="font-semibold text-teal-700">Download</a></span>}</span>
              {editable && (
                <>
                  <button type="button" onClick={() => inputs.current[kind]?.click()} disabled={!!busy} className="font-semibold text-teal-700">{busy === kind ? "Uploading…" : d ? "Replace" : "Upload"}</button>
                  <input ref={(el) => { inputs.current[kind] = el; }} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={(e) => upload(kind, e.target.files?.[0])} />
                </>
              )}
            </li>
          );
        })}
      </ul>
      {(error || missing) && <p role="alert" className="text-sm text-bad">{error ?? "Upload all three documents before submitting."}</p>}
      {editable && (
        <form action={submitAction} className="flex items-center gap-3">
          <Button size="sm" disabled={docs.length < 3 || !!busy}>Submit for review</Button>
          <span className="text-xs text-muted">PDF, JPG or PNG, up to 5 MB each.</span>
        </form>
      )}
    </Card>
  );
}
