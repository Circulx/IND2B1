import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { Card, Td, Th, Table } from "./primitives";

export type Slab = { minQty: number; maxQty: number | null; unitPricePaise: number };

/** Volume price table. `activeIndex` highlights the buyer's current slab. */
export function SlabTable({ slabs, unit, qtyUnit, activeIndex, footnote }: { slabs: Slab[]; unit: string; qtyUnit: string; activeIndex?: number; footnote?: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <thead><tr><Th>Order quantity</Th><Th right>Price / {unit}</Th></tr></thead>
        <tbody>
          {slabs.map((s, i) => {
            const on = i === activeIndex;
            const range = s.maxQty === null ? `${s.minQty} ${qtyUnit} +` : `${s.minQty} – ${s.maxQty} ${qtyUnit}`;
            return (
              <tr key={i} className={cn(on && "bg-teal-50")}>
                <Td className={cn(on && "font-semibold text-teal-700")}>{range}{on && " · your slab"}</Td>
                <Td right className={cn(on && "font-semibold text-teal-700")}>{formatINR(s.unitPricePaise, { decimals: true })}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {footnote && <div className="bg-subtle px-3 py-2.5 text-xs text-muted">{footnote}</div>}
    </Card>
  );
}

export type TaxLine = { label: string; paise: number };

/** Taxable value, CGST/SGST or IGST lines, total. Mirrors the GST invoice. */
export function GstSummary({ lines, totalPaise, className }: { lines: TaxLine[]; totalPaise: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 text-sm", className)}>
      {lines.map((l) => (
        <div key={l.label} className="flex justify-between"><span className="text-muted">{l.label}</span><span className="font-mono tabular">{formatINR(l.paise, { decimals: true })}</span></div>
      ))}
      <div className="flex justify-between border-t border-line pt-2.5 font-display text-[17px] font-bold">
        <span>Total</span><span className="font-mono tabular">{formatINR(totalPaise, { decimals: true })}</span>
      </div>
    </div>
  );
}

/** GST split: same state → CGST + SGST, different state → IGST. */
export function gstLines(taxablePaise: number, ratePct: number, sameState: boolean): { lines: TaxLine[]; taxPaise: number } {
  const tax = Math.round((taxablePaise * ratePct) / 100);
  if (sameState) {
    const half = Math.round(tax / 2);
    return { taxPaise: half * 2, lines: [{ label: `CGST ${ratePct / 2}%`, paise: half }, { label: `SGST ${ratePct / 2}%`, paise: half }] };
  }
  return { taxPaise: tax, lines: [{ label: `IGST ${ratePct}% (inter-state)`, paise: tax }] };
}
