"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateCampaignPoAction, type FinanceActionState } from "@/features/finance/exchange-rates/actions";
import { formatMoney } from "@/features/campaigns/utils";
import { PO_STATUS_LABELS } from "@/lib/finance/po/status";
import type { PoTrackerRow } from "../types";

export function PoDetailsPane({ row, currencies, canEdit, height, onResize, onClose, onDirtyChange, onPendingChange }: {
  row: PoTrackerRow;
  currencies: { code: string; name: string }[];
  canEdit: boolean;
  height: number;
  onResize: (height: number) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const router = useRouter();
  const paneRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ y: number; height: number; available: number } | null>(null);
  function resize(value: number) { onResize(Math.max(25, Math.min(65, value))); }
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FinanceActionState>({ ok: false });
  const [values, setValues] = useState({
    po_number: row.po_number ?? "",
    po_currency: row.po_currency ?? row.campaign_currency,
    po_amount_original: String(row.po_amount_original),
    po_expiry_date: row.po_expiry_date ?? "",
    override_reason: "",
  });
  function change(field: keyof typeof values, value: string) {
    setValues(previous => ({ ...previous, [field]: value }));
    onDirtyChange(true);
    setResult({ ok: false });
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canEdit) return;
    const formData = new FormData(event.currentTarget);
    onPendingChange(true);
    startTransition(async () => {
      try {
        const response = await updateCampaignPoAction({ ok: false }, formData);
        setResult(response);
        if (response.ok) {
          onDirtyChange(false);
          router.refresh();
        }
      } catch {
        setResult({ ok: false, message: "Unable to save PO. Your changes are still here; try again." });
      } finally {
        onPendingChange(false);
      }
    });
  }
  return <section ref={paneRef} data-shortcut-pane className="po-details-pane" style={{ height: `${height}%` }} aria-labelledby="po-details-title">
    <div className="po-pane-resizer" role="separator" tabIndex={0} aria-label="Resize PO details" aria-orientation="horizontal" aria-valuemin={25} aria-valuemax={65} aria-valuenow={Math.round(height)} aria-valuetext={`${Math.round(height)} percent of workspace`} title="Drag up or down to resize. Use arrow keys when focused. Double-click to reset."
      onPointerDown={event => {
        if (event.button !== 0) return;
        const pane = paneRef.current;
        const available = pane?.parentElement?.clientHeight;
        if (!pane || !available) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { y: event.clientY, height: pane.getBoundingClientRect().height, available };
      }}
      onPointerMove={event => {
        const drag = dragRef.current;
        if (drag) resize((drag.height + drag.y - event.clientY) / drag.available * 100);
      }}
      onPointerUp={event => { dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { dragRef.current = null; }}
      onLostPointerCapture={() => { dragRef.current = null; }}
      onDoubleClick={() => resize(44)}
      onKeyDown={event => {
        if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        resize(event.key === "Home" ? 25 : event.key === "End" ? 65 : height + (event.key === "ArrowUp" ? 5 : -5));
      }}><span /></div>
    <div className="po-details-heading">
      <div><h2 id="po-details-title">PO details · {row.po_number || "Not assigned"}</h2>
        <p>{row.client_name} · {row.brand_name} · {row.campaign_name}</p></div>
      <Link href={`/campaigns/${row.campaign_id}`} className="po-link">Open campaign</Link>
      <Button data-shortcut-close type="button" size="icon" variant="ghost" disabled={pending} aria-label="Close PO details" onClick={onClose}><X size={16} /></Button>
    </div>
    <form onSubmit={save} className="po-details-form">
      <input type="hidden" name="campaign_id" value={row.campaign_id} />
      <div className="po-details-scroll">
        <fieldset className="po-edit-fields" disabled={pending || !canEdit}>
          <label className="po-field">PO number<input className="po-control" name="po_number" value={values.po_number} maxLength={120} onChange={event => change("po_number", event.target.value)} /></label>
          <label className="po-field">PO currency<select className="po-control" name="po_currency" value={values.po_currency} onChange={event => change("po_currency", event.target.value)}>
            {!currencies.some(currency => currency.code === values.po_currency) && <option value={values.po_currency}>{values.po_currency}</option>}
            {currencies.map(currency => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}
          </select></label>
          <label className="po-field">PO amount<input className="po-control" name="po_amount_original" type="number" min="0" step="0.01" required value={values.po_amount_original} onChange={event => change("po_amount_original", event.target.value)} /></label>
          <label className="po-field">Expiry date<input className="po-control" name="po_expiry_date" type="date" value={values.po_expiry_date} onChange={event => change("po_expiry_date", event.target.value)} /></label>
          <label className="po-field po-change-note">Change note<input className="po-control" name="override_reason" maxLength={500} value={values.override_reason} placeholder="Reason for this revision (optional)" onChange={event => change("override_reason", event.target.value)} /></label>
        </fieldset>
        <dl className="po-details-totals">
          <div><dt>Campaign budget / converted PO</dt><dd>{formatMoney(row.po_amount_campaign_currency, row.campaign_currency)}</dd></div>
          <div><dt>Consumed</dt><dd>{formatMoney(row.po_consumed_amount, row.campaign_currency)}</dd></div>
          <div><dt>Remaining</dt><dd>{formatMoney(row.po_remaining_amount, row.campaign_currency)}</dd></div>
          <div><dt>Status</dt><dd>{PO_STATUS_LABELS[row.po_status]}</dd></div>
          <div><dt>Current FX</dt><dd>{row.po_exchange_rate == null ? "Not set" : `1 ${row.po_currency ?? row.campaign_currency} = ${row.po_exchange_rate} ${row.campaign_currency}`}</dd></div>
          <div><dt>Limit override</dt><dd>{row.po_override_approved ? "Approved" : "Not approved"}</dd></div>
        </dl>
      </div>
      <div className="po-details-footer">
        <div><p>{canEdit ? "Changes update the campaign PO. FX, consumption and remaining balance recalculate on save." : "You have view access. Finance write permission is required to save PO revisions."}</p>
          {result.message && <p role={result.ok ? "status" : "alert"} className={result.ok ? "po-save-success" : "po-save-error"}>{result.message}</p>}
          {result.fieldErrors && <p role="alert" className="po-save-error">{Object.values(result.fieldErrors).flat().join(" · ")}</p>}
        </div>
        <Button type="submit" size="sm" disabled={pending || !canEdit}>{pending ? "Saving…" : "Save PO"}</Button>
      </div>
    </form>
  </section>;
}
