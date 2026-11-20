"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getCreatorQuotationHistory, type CreatorQuotationHistoryLine } from "@/features/quotations/creator-history-action";
import { quotationDetailPath } from "@/features/quotations/constants";
import { computeAgencyFee } from "@/lib/commercial/commercial-engine";

const money = (value: number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CreatorQuotationHistory({ influencerId }: { influencerId: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<CreatorQuotationHistoryLine[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLines([]); setCount(null); setError("");
    if (!influencerId) { setCount(0); return; }
    getCreatorQuotationHistory(influencerId).then(result => {
      if (!active) return;
      if (result.ok) { setLines(result.lines); setCount(result.count); }
      else setError(result.message);
    }).catch(() => { if (active) setError("Could not load quotation history."); });
    return () => { active = false; };
  }, [influencerId, retry]);

  return <>
    <div className="r">
      <span>Quotations including this creator</span>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <b>{count ?? (error ? "—" : "Loading…")}</b>
        <button type="button" className="tw-b sm" onClick={() => setOpen(true)}>View list</button>
      </span>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[min(1400px,calc(100vw-40px))] max-h-[85dvh] overflow-hidden flex flex-col" style={{ zIndex: 300 }} overlayClassName="z-[299]">
        <DialogHeader className="pr-10">
          <DialogTitle>Creator quotation history</DialogTitle>
          <DialogDescription>{count == null ? "Loading quotations…" : `${count} quotation${count === 1 ? "" : "s"} · ${lines.length} price line${lines.length === 1 ? "" : "s"}`}
            {" · Saved prices and agency fees, excluding VAT, in each line’s currency. Each price option is listed separately."}
          </DialogDescription>
        </DialogHeader>
        {error ? <div role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> :
          count === 0 ? <p>No quotations include this creator yet.</p> :
          <div className="overflow-auto min-h-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted"><tr>
                {["Quotation", "Client", "Brand", "Campaign / quotation name", "Creator cost", "Client price before fees", "Agency fee %", "Agency fee amount", "Client total incl. fees"].map(label => <th key={label} className="p-3 text-left font-semibold whitespace-nowrap">{label}</th>)}
              </tr></thead>
              <tbody>{lines.map(line => {
                const fee = computeAgencyFee({ revenue: Number(line.revenue), afPct: Number(line.af_pct) });
                return <tr key={line.id} className="border-b">
                <td className="p-3 whitespace-nowrap">
                  <Link className="text-blue-600 underline" href={quotationDetailPath(line.quotation_id)} target="_blank" rel="noopener noreferrer">{line.quotations.serial_number ?? "Open quotation"}</Link>
                  <div className="text-xs text-muted-foreground">{line.quotations.is_archived ? "Archived" : line.quotations.status}</div>
                </td>
                <td className="p-3">{line.quotations.client?.name ?? line.quotations.temporary_client_name ?? "—"}</td>
                <td className="p-3">{line.quotations.brand?.name ?? line.quotations.temporary_brand_name ?? "—"}</td>
                <td className="p-3 min-w-48">{line.quotations.campaign?.name ?? line.quotations.name}</td>
                <td className="p-3 whitespace-nowrap font-mono">{line.cost_currency} {Number(line.cost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="p-3 whitespace-nowrap font-mono">{line.cost_currency} {money(line.revenue)}</td>
                <td className="p-3 whitespace-nowrap font-mono">{fee.afPct.toLocaleString("en-US", { maximumFractionDigits: 2 })}%</td>
                <td className="p-3 whitespace-nowrap font-mono">{line.cost_currency} {money(fee.afValue)}</td>
                <td className="p-3 whitespace-nowrap font-mono">{line.cost_currency} {money(Number(line.revenue) + fee.afValue)}</td>
              </tr>})}</tbody>
            </table>
          </div>}
      </DialogContent>
    </Dialog>
  </>;
}
