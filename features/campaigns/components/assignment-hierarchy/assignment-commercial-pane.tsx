"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAssignmentFx } from "./use-assignment-fx";
import { aggregateCampaignDisplayFinancials } from "@/lib/campaigns/campaign-display-financials";
import { X } from "lucide-react";
import { CommercialRevisionDialog, type CommercialRevisionDialogLine } from "../commercial-revision-dialog";
import { formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { updateAssignmentLineCommercialsAction } from "@/features/campaigns/actions/update-assignment-line-commercials";
import { updateAssignmentDeliverableAction } from "@/features/campaigns/actions/assignment-deliverable-actions";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import { resolveAssignmentLineCurrency } from "@/lib/campaigns/assignment-line-currency";
import { computeAgencyFeeAmount, rollupLineClientCommercial } from "@/lib/assignments/client-billing-commercial";
import { computeVatLine, roundMoney } from "@/lib/vat/calculations";
import { resolveAssignmentTypeCommercial } from "@/lib/campaigns/assignment-type-commercial";
import { useAssignmentGridEditSession } from "./assignment-grid-edit-session";
import "@/app/styles/assignment-commercial-pane.css";

type Target = { lineId: string; deliverableId?: string; postId?: string };
type Draft = { currency: string; qty: number; cost: number; urCost: number; costVat: number; revenue: number; urRevenue: number; af: number; revVat: number };
const PaneContext = createContext<{ open: (target: Target) => void; selected: Target | null }>({ open: () => {}, selected: null });
export const useAssignmentCommercialPane = () => useContext(PaneContext);
const keyOf = (target: Target) => `${target.lineId}:${target.deliverableId ?? "parent"}`;

function FormattedNumber({ value, onChange, disabled, integer = false, max, percentage = false }: {
  value: number; onChange: (value: number) => void; disabled?: boolean; integer?: boolean; max?: number; percentage?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const formatted = value.toLocaleString("en-US", { minimumFractionDigits: integer ? 0 : 2, maximumFractionDigits: integer ? 0 : 2 });
  return <span className={percentage ? "acp-number acp-percentage" : "acp-number"}><input type="text" inputMode={integer ? "numeric" : "decimal"} autoComplete="off" disabled={disabled}
    value={editing ?? formatted} onFocus={() => setEditing(formatted)}
    onChange={event => {
      const next = event.target.value.replace(/,/g, "").trim();
      if (!(integer ? /^\d*$/ : /^\d*(?:\.\d{0,2})?$/).test(next)) return;
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || (max !== undefined && parsed > max)) return;
      setEditing(next);
      onChange(integer ? Math.max(1, parsed) : parsed);
    }} onBlur={() => setEditing(null)} />{percentage && <span className="acp-percent-suffix" aria-hidden="true">%</span>}</span>;
}

export function AssignmentCommercialPaneProvider({ campaignId, hierarchy, currencies, enabled, children }: {
  campaignId: string; hierarchy: AssignmentHierarchy; currencies: { value: string; label: string }[]; enabled: boolean; children: ReactNode;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const pane = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<Draft>>>({});
  const [revision, setRevision] = useState<{ quotationId: string; lines: CommercialRevisionDialogLine[]; draftKey: string } | null>(null);
  const [height, setHeight] = useState(360);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (!enabled) setSelected(null); }, [enabled]);
  const router = useRouter();
  const gridEdit = useAssignmentGridEditSession();
  useEffect(() => { setHost(marker.current?.closest<HTMLElement>("[data-campaign-workspace-scroll]")?.parentElement ?? null); }, []);
  const group = hierarchy.groups.find(entry => entry.line.id === selected?.lineId);
  const line = group?.line;
  const child = group?.deliverables.find(entry => entry.id === selected?.deliverableId);
  const isPackageChild = Boolean(child && (line?.assignment?.pricing_mode ?? "package") === "package");
  const selectedPost = child?.posts.find(post => post.id === selected?.postId);
  const packageShare = isPackageChild && child && selectedPost && line ? resolveAssignmentTypeCommercial({ posts: child.posts, post: selectedPost, deliverable: child, line: { revenueBeforeVat: line.revenue_before_vat, costBeforeVat: line.cost_before_vat, usageRightsAmount: line.usage_rights_amount, usageRightsCost: line.usage_rights_cost, agencyFeePercent: line.agency_fee_percent } }) : null;
  const selectedKey = selected ? keyOf(selected) : "";
  const units = packageShare?.qty ?? child?.quantity ?? group?.deliverables.reduce((sum, entry) => sum + entry.quantity, 0) ?? 1;
  const cost = Number(packageShare?.cost ?? child?.cost_before_vat ?? line?.cost_before_vat ?? 0);
  const initial: Draft = {
    currency: line ? resolveAssignmentLineCurrency(line) : hierarchy.currency_code,
    qty: Math.max(1, units), cost, urCost: Number(packageShare?.usageRightsCost ?? child?.usage_rights_cost ?? line?.usage_rights_cost ?? 0),
    costVat: child && !isPackageChild ? (child.cost_before_vat > 0 ? roundMoney(child.cost_vat_amount / child.cost_before_vat * 100) : Number(line?.cost_vat_exempt ? 0 : line?.cost_vat_percent ?? 0)) : Number(line?.cost_vat_exempt ? 0 : line?.cost_vat_percent ?? 0),
    revenue: Number(packageShare?.rev ?? child?.revenue_before_vat ?? line?.revenue_before_vat ?? 0),
    urRevenue: Number(packageShare?.usageRightsAmount ?? child?.usage_rights_amount ?? line?.usage_rights_amount ?? 0),
    af: Number(child?.agency_fee_percent ?? line?.agency_fee_percent ?? 0),
    revVat: Number(child?.revenue_vat_percent ?? (line?.revenue_vat_exempt ? 0 : line?.revenue_vat_percent) ?? 0),
  };
  const draft = { ...initial, ...drafts[selectedKey] };
  const readOnly = pending || gridEdit.isEditing || gridEdit.saving || isPackageChild || Boolean(child?.is_locked || child?.is_synthetic);
  const fx = useAssignmentFx(line, draft.currency, !readOnly && !child && !drafts[selectedKey]);
  let fxFinancials: ReturnType<typeof aggregateCampaignDisplayFinancials> | null = null;
  try {
    fxFinancials = aggregateCampaignDisplayFinancials({ displayCurrency: "EGP", rateToEgpByCurrency: new Map(Object.entries(fx.rates)), lines: [{
      currency_code: draft.currency, cost_before_vat: draft.cost, revenue_before_vat: draft.revenue,
      cost_received: !child && fx.costCurrency !== draft.currency ? line?.cost_received : draft.cost,
      cost_received_currency: child ? draft.currency : fx.costCurrency,
      usage_rights_amount: draft.urRevenue, usage_rights_cost: draft.urCost, agency_fee_percent: draft.af,
      cost_fx_override: fx.overrides.cost, revenue_fx_override: fx.overrides.revenue,
      fx_cost_revenue_cross_rate: line?.fx_cost_revenue_cross_rate,
    }] });
  } catch { /* An absent FX rate must not fabricate an equivalent. */ }
  const afAmount = computeAgencyFeeAmount(draft.revenue, draft.urRevenue, draft.af);
  const costTax = computeVatLine({ beforeVat: draft.cost, vatPercent: draft.costVat });
  const revenueTax = computeVatLine({ beforeVat: draft.revenue + draft.urRevenue + afAmount, vatPercent: draft.revVat });
  const profit = rollupLineClientCommercial({ revenueBeforeVat: draft.revenue, usageRightsAmount: draft.urRevenue, usageRightsCost: draft.urCost, agencyFeePercent: draft.af, costBeforeVat: draft.cost });
  const profitCost = roundMoney(draft.cost + draft.urCost);
  const health = profit.gp < 0 ? "weak" : profit.billableBase <= 0 ? "neutral" : profit.marginPercent >= 20 ? "healthy" : profit.marginPercent < 10 ? "weak" : "watch";
  const percent = (value: number | null) => value === null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  const profitAmount = draft.currency + " " + profit.gp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  async function saveFx() {
    if (pending || !fx.dirty || !fx.valid || drafts[selectedKey]) return;
    setPending(true); setMessage(null);
    try {
      const result = await fx.save(campaignId);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) { fx.reset(); router.refresh(); }
    } catch { setMessage({ ok: false, text: "Unable to save FX. Your edits have been kept." }); }
    finally { setPending(false); }
  }
  function open(target: Target) {
    if (!enabled || pending) return;
    setSelected(target); setMessage(null);
  }
  function change(field: keyof Draft, value: string | number) {
    const amountChanges = field === "qty" ? { cost: roundMoney(draft.cost / draft.qty * Number(value)), revenue: roundMoney(draft.revenue / draft.qty * Number(value)) } : {};
    setDrafts(previous => ({ ...previous, [selectedKey]: { ...previous[selectedKey], ...amountChanges, [field]: value } }));
    setMessage(null);
  }
  function resize(value: number) {
    setHeight(Math.max(180, Math.min(Math.max(180, (host?.clientHeight ?? 700) * .65), value)));
  }
  async function save() {
    if (!line || !selected || pending || readOnly || fx.dirty || !drafts[selectedKey]) return;
    setPending(true); setMessage(null);
    try {
      const result = child ? await updateAssignmentDeliverableAction({
        campaign_id: campaignId, campaign_line_id: line.id, deliverable_id: child.id,
        platform: child.platform, deliverable_type: child.deliverable_type,
        quantity: draft.qty, unit_cost: draft.cost / draft.qty, unit_revenue: draft.revenue / draft.qty,
        usage_rights_cost: draft.urCost, usage_rights_amount: draft.urRevenue, agency_fee_percent: draft.af,
        cost_vat_percent: draft.costVat, revenue_vat_percent: draft.revVat,
        live_date: child.live_date, notes: child.notes, commercial_only: true,
      }) : await updateAssignmentLineCommercialsAction({ campaignId, lines: [{
        lineId: line.id, revenue_before_vat: draft.revenue, cost_before_vat: draft.cost,
        usage_rights_amount: draft.urRevenue, usage_rights_cost: draft.urCost, agency_fee_percent: draft.af,
        revenue_vat_percent: draft.revVat, cost_vat_percent: draft.costVat, currency_code: draft.currency,
      }] });
      if (!result.ok && "code" in result && result.code === "FINANCE_LOCKED") {
        if ("revisionLines" in result && result.revisionLines?.length && result.quotationId) {
          setRevision({ quotationId: result.quotationId, lines: result.revisionLines, draftKey: selectedKey });
          setMessage({ ok: false, text: "A Commercial Revision is required. Review your changes in the dialog; cancelling keeps your edits." });
        } else {
          setMessage({ ok: false, text: "A Commercial Revision is required, but this assignment is missing its quotation or commercial-line link. Open Commercial Workspace to review the linkage. Your edits have been kept." });
        }
        return;
      }
      setMessage({ ok: result.ok, text: result.message ?? (result.ok ? "Line saved." : "Unable to save line.") });
      if (result.ok) {
        setDrafts(previous => { const next = { ...previous }; delete next[selectedKey]; return next; });
        router.refresh();
      }
    } catch { setMessage({ ok: false, text: "Unable to save. Your edits have been kept; please try again." }); }
    finally { setPending(false); }
  }
  const number = (label: string, field: keyof Omit<Draft, "currency">, options?: { disabled?: boolean; max?: number; integer?: boolean }) => <label className="acp-field">{label}<FormattedNumber key={selectedKey + field} value={draft[field]} disabled={readOnly || fx.dirty || options?.disabled} integer={options?.integer} max={options?.max} percentage={field === "costVat" || field === "revVat" || field === "af"} onChange={value => change(field, value)} />{!["qty", "costVat", "revVat", "af"].includes(field) && fx.equivalent(draft[field], field === "cost" || field === "urCost" ? "cost" : "revenue")}</label>;
  const total = (label: string, value: number, side: "cost" | "revenue" = "revenue") => <div className="acp-total"><span>{label}</span><output>{value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</output>{fx.equivalent(value, side)}</div>;
  const editor = enabled && line && selected ? <section ref={pane} data-shortcut-pane className="assignment-commercial-pane" aria-label="Assignment cost and revenue editor" style={{ height }}>
    <div className="acp-resizer" role="separator" aria-label="Resize assignment editor" aria-orientation="horizontal" aria-valuemin={180} aria-valuemax={Math.max(180, Math.floor((host?.clientHeight ?? 700) * .65))} aria-valuenow={Math.round(height)} tabIndex={0} title="Drag to resize; double-click to reset"
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { y: event.clientY, height: pane.current?.clientHeight ?? height }; }}
      onPointerMove={event => { if (drag.current) resize(drag.current.height + drag.current.y - event.clientY); }}
      onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onDoubleClick={() => resize(360)} onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); resize(height + (event.key === "ArrowUp" ? 20 : -20)); } }}><span /></div>
    <div className="acp-heading">
      <label className="acp-currency">Curr<select aria-label="Assignment editor currency" value={draft.currency} disabled={readOnly || fx.dirty || Boolean(child)} onChange={event => change("currency", event.target.value)}>{!currencies.some(entry => entry.value === draft.currency) && <option value={draft.currency}>{draft.currency}</option>}{currencies.map(entry => <option key={entry.value} value={entry.value}>{entry.value}</option>)}</select></label>
      <div className="acp-identity"><strong>{line.document_number} · {formatCreatorDisplayName(line.assignment?.influencer_name ?? line.name)}</strong><span>{child ? `Child · ${selectedPost?.platform ?? child.platform} · ${selectedPost?.deliverable_type_label ?? child.deliverable_type_label} · ${isPackageChild ? "package share" : "deliverable totals"} (${draft.qty} ${draft.qty === 1 ? "unit" : "units"})` : "Parent assignment · package / assignment totals"}</span></div>
      <div className="acp-profit" data-health={health} aria-label="Live profitability" title="Margin health: green ≥20%, amber 10–20%, red <10% or a loss. Based on GP divided by revenue, excluding VAT.">
        <div title="Revenue + UR Rev + AF − Cost − UR Cost; excludes VAT"><span>GP</span><output>{profitAmount}</output>{fxFinancials && fx.valid && <small className="acp-equivalent">≈ EGP {fxFinancials.gp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>}</div>
        <div title="GP ÷ revenue including UR Rev and AF, excluding VAT"><span>GP %</span><output>{percent(profit.billableBase > 0 ? profit.marginPercent : null)}</output></div>
        <div title="Same profit amount as GP, excluding VAT"><span>Margin</span><output>{profitAmount}</output>{fxFinancials && fx.valid && <small className="acp-equivalent">≈ EGP {fxFinancials.gp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>}</div>
        <div title="GP ÷ cost including UR Cost, excluding VAT"><span>Margin % (markup)</span><output>{percent(profitCost > 0 ? profit.gp / profitCost * 100 : null)}</output></div>
        <div title="FX gain/loss is separate from GP; cost valued at the revenue FX baseline, excluding VAT."><span>FX Gain/Loss</span><output style={{ color: (fxFinancials?.fx_gain_loss ?? 0) < 0 ? "#b91c1c" : (fxFinancials?.fx_gain_loss ?? 0) > 0 ? "#087443" : "#52637c" }}>{fxFinancials && fx.valid ? "EGP " + fxFinancials.fx_gain_loss.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</output></div>
      </div>
      <button data-shortcut-close type="button" className="acp-button" aria-label="Close assignment editor" disabled={pending} onClick={() => setSelected(null)}><X size={16} /></button>
    </div>
    <form className="acp-form" onSubmit={event => { event.preventDefault(); if (fx.dirty) void saveFx(); else void save(); }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); event.stopPropagation(); event.currentTarget.requestSubmit(); } }}>
      <div className="acp-scroll">
        {gridEdit.isEditing && <div className="acp-notice">Save or cancel the table edits before editing amounts here.</div>}
        {isPackageChild && <div className="acp-notice">This child is a calculated share of the package. <button type="button" onClick={() => open({ lineId: line.id })}>Edit package totals</button></div>}
        {!isPackageChild && child?.is_locked && <div className="acp-notice">This child is invoiced. Financial changes use the existing finance revision workflow.</div>}
        <div className="acp-sections">
          <section className="acp-section acp-cost" aria-label="Cost"><h3>Cost {fx.controls("cost")}</h3><div className="acp-fields">
            {number("Unit", "qty", { integer: true, max: 999, disabled: !child })}
            <label className="acp-field">Unit cost<FormattedNumber key={selectedKey + "unitCost"} disabled={readOnly || fx.dirty} value={roundMoney(draft.cost / draft.qty)} onChange={value => change("cost", roundMoney(value * draft.qty))} />{fx.equivalent(roundMoney(draft.cost / draft.qty), "cost")}</label>
            {number("Cost amount", "cost")}{number("UR Cost", "urCost")}{number("Cost VAT %", "costVat", { max: 100 })}
            {total("Cost VAT", costTax.vatAmount, "cost")}{total("Cost incl. VAT", costTax.afterVat, "cost")}{total("Total cost", roundMoney(costTax.afterVat + draft.urCost), "cost")}
          </div></section>
          <section className="acp-section acp-revenue" aria-label="Revenue"><h3>Revenue {fx.controls("revenue")}</h3><div className="acp-fields">
            {number("Revenue", "revenue")}{number("UR Rev", "urRevenue")}{number("AF %", "af", { max: 100 })}{total("AF", afAmount)}{number("Rev VAT %", "revVat", { max: 100 })}{total("Rev VAT", revenueTax.vatAmount)}{total("Total Billing", revenueTax.afterVat)}
          </div></section>
        </div>
      </div>
      <div className="acp-footer"><div>{fx.dirty && <span>Custom FX is pinned. Save or reset FX before changing native amounts.</span>}<span>{child ? "Currency is inherited from the parent assignment." : "Units come from child deliverables. Currency changes keep the entered amounts."} Calculated totals include VAT; total cost also includes UR Cost.</span>{Object.keys(drafts).length > 0 && <span>Unsaved edits are kept while switching rows in this tab.</span>}{message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "acp-success" : "acp-error"}>{message.text}</p>}</div>{fx.dirty && <><button type="button" className="acp-button" disabled={pending} onClick={fx.reset}>Reset FX edits</button><button type="button" className="acp-button acp-primary" disabled={pending || !fx.valid || Boolean(drafts[selectedKey])} onClick={() => void saveFx()}>Save FX rates</button></>}<button className="acp-button" type="button" disabled={pending || !drafts[selectedKey]} onClick={() => setDrafts(previous => { const next = { ...previous }; delete next[selectedKey]; return next; })}>Reset edits</button><button className="acp-button acp-primary" type="submit" disabled={readOnly || fx.dirty || !drafts[selectedKey]}>{pending ? "Saving…" : "Save line"}</button></div>
    </form>
  </section> : null;
  return <PaneContext.Provider value={{ open, selected: enabled ? selected : null }}>{children}{revision && <CommercialRevisionDialog
    open campaignHeaderId={campaignId} quotationId={revision.quotationId} lines={revision.lines}
    onOpenChange={open => { if (!open) setRevision(null); }}
    onSubmitted={() => {
      const submittedKey = revision.draftKey;
      setDrafts(previous => { const next = { ...previous }; delete next[submittedKey]; return next; });
      setMessage({ ok: true, text: "Commercial Revision submitted for approval. Existing amounts remain until the revision is approved." });
      setRevision(null);
      router.refresh();
    }}
  />}<span ref={marker} hidden />{editor && (host ? createPortal(editor, host) : editor)}</PaneContext.Provider>;
}
