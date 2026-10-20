"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getCreatorQuotationHistory, type CreatorQuotationHistoryLine } from "@/features/quotations/creator-history-action";
import { quotationDetailPath } from "@/features/quotations/constants";

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
      <DialogContent className="sm:max-w-5xl max-h-[85dvh] overflow-hidden flex flex-col" style={{ zIndex: 300 }} overlayClassName="z-[299]">
        <DialogHeader className="pr-10">
          <DialogTitle>Creator quotation history</DialogTitle>
          <DialogDescription>{count == null ? "Loading quotations…" : `${count} quotation${count === 1 ? "" : "s"} · ${lines.length} price line${lines.length === 1 ? "" : "s"}`}
            {" · Internal creator costs, excluding VAT. Each price option is listed separately."}
          </DialogDescription>
        </DialogHeader>
        {error ? <div role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> :
          count === 0 ? <p>No quotations include this creator yet.</p> :
          <div className="overflow-auto min-h-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted"><tr>
                {["Quotation", "Client", "Brand", "Campaign / quotation name", "Creator cost"].map(label => <th key={label} className="p-3 text-left font-semibold whitespace-nowrap">{label}</th>)}
              </tr></thead>
              <tbody>{lines.map(line => <tr key={line.id} className="border-b">
                <td className="p-3 whitespace-nowrap">
                  <Link className="text-blue-600 underline" href={quotationDetailPath(line.quotation_id)} target="_blank" rel="noopener noreferrer">{line.quotations.serial_number ?? "Open quotation"}</Link>
                  <div className="text-xs text-muted-foreground">{line.quotations.is_archived ? "Archived" : line.quotations.status}</div>
                </td>
                <td className="p-3">{line.quotations.client?.name ?? line.quotations.temporary_client_name ?? "—"}</td>
                <td className="p-3">{line.quotations.brand?.name ?? line.quotations.temporary_brand_name ?? "—"}</td>
                <td className="p-3 min-w-48">{line.quotations.campaign?.name ?? line.quotations.name}</td>
                <td className="p-3 whitespace-nowrap font-mono">{line.cost_currency} {Number(line.cost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>)}</tbody>
            </table>
          </div>}
      </DialogContent>
    </Dialog>
  </>;
}
