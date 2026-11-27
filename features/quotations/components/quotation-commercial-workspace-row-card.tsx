import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { QuotationDecimalInput } from "./quotation-decimal-input";
import { QuotationCreatorFxFields } from "./quotation-creator-fx-fields";
import { COMMERCIAL_CURRENCIES } from "@/lib/commercial/fx-aggregation";
import { type CommercialInputMode } from "@/lib/commercial/commercial-engine";
import { applyCommercialWorkspaceBulkOp, patchCommercialWorkspaceDraft } from "@/lib/quotations/commercial-workspace/bulk-transforms";
import type { CommercialWorkspaceColumnId } from "@/lib/quotations/commercial-workspace/column-preferences";
import { resolveQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import { computeQuotationRowComputed, computeQuotationRowClientCommercials } from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/features/quotations/types";
export type CommercialWorkspaceRowCardModel = {
  itemId: string;
  item: QuotationItemRow;
  influencerName: string;
  optionLabel: string | null;
  revenueEgp: number;
  costEgp: number;
  gpValueEgp: number;
  gpPct: number;
  draft: QuotationRowDraft;
};

type Props = {
  row: CommercialWorkspaceRowCardModel;
  selected: boolean;
  canManage: boolean;
  show: (id: CommercialWorkspaceColumnId) => boolean;
  onToggleSelected: () => void;
  onStageDraft: (next: QuotationRowDraft) => void;
  displayCurrency?: string;
  displayFxRateToEgp?: number;
};


const modes: [CommercialInputMode,string][] = [["cost_markup_pct","Markup %"],["cost_gp_pct","GP margin %"],["cost_revenue","Client cost"],["cost_gp_value","GP value"]];
export function commercialGridColumns(show: Props["show"]) {
  return ["24px", "minmax(160px,1.5fr)", show("mode") && "128px", show("cost") && "100px", show("revenue") && "108px", (show("gpPctInput") || show("gpPct")) && "86px", show("gp") && "100px", show("afPct") && "76px", "112px"].filter(Boolean).join(" ");
}
export function QuotationCommercialWorkspaceRowCard({row,selected,canManage,show,onToggleSelected,onStageDraft,displayCurrency="EGP",displayFxRateToEgp=1}: Props) {
  const d=row.draft, computed=computeQuotationRowComputed(d), client=computeQuotationRowClientCommercials(d);
  const profile=resolveQuotationCreatorProfileSource(row.item,row.item.platform?[row.item.platform]:[]);
  const name=profile.displayName || row.item.creator_name || row.influencerName;
  const money=(value:number)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(value);
  const patch=(changes:Partial<QuotationRowDraft>)=>onStageDraft(patchCommercialWorkspaceDraft(d, changes));
  return <div className="qx-cwrow" style={{gridTemplateColumns:commercialGridColumns(show)}}>
    <span><input type="checkbox" checked={selected} onChange={onToggleSelected} aria-label={`Select ${name}`} /></span>
    <div className="q-cw-identity"><CreatorAvatarImage avatarUrl={profile.avatarUrl} profileUrl={profile.profile_url} alt={name} sizeClassName="!size-[26px]" /><div><b>{name}</b><small>{row.optionLabel || "Deliverables"}</small>{show("currency") && <select className="q-cw-currency" aria-label={`Currency for ${name}`} value={d.costCurrency} disabled={!canManage} onChange={e=>onStageDraft(applyCommercialWorkspaceBulkOp(d,{kind:"set_currency",currency:e.target.value}))}>{COMMERCIAL_CURRENCIES.map(code=><option key={code}>{code}</option>)}</select>}</div></div>
    {show("mode") && <select className="sel" aria-label={`Pricing mode for ${name}`} value={d.mode} disabled={!canManage} onChange={e=>patch({mode:e.target.value as CommercialInputMode})}>{modes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}
    {show("cost") && <QuotationDecimalInput className="in in--num" aria-label={`Cost for ${name}`} disabled={!canManage} value={d.cost} onCommit={cost=>patch({cost})} />}
    {show("revenue") && <QuotationDecimalInput className="in in--num" aria-label={`Client cost for ${name}`} disabled={!canManage || d.mode!=="cost_revenue"} value={computed.revenue} onCommit={revenue=>patch({revenue})} />}
    {(show("gpPctInput") || show("gpPct")) && <QuotationDecimalInput className="in in--num" aria-label={`GP percent for ${name}`} disabled={!canManage || !["cost_gp_pct","cost_markup_pct"].includes(d.mode)} value={d.mode==="cost_markup_pct" ? d.gpPct : computed.gpPct} onCommit={gpPct=>patch({gpPct})} />}
    {show("gp") && (d.mode==="cost_gp_value" ? <QuotationDecimalInput className="in in--num" aria-label={`GP value for ${name}`} disabled={!canManage} value={d.gpValue} onCommit={gpValue=>patch({gpValue})} /> : <b className="num mono" style={{color:computed.gpValue<0?"var(--bad)":"var(--ok)"}}>{money(computed.gpValue)}</b>)}
    {show("afPct") && <QuotationDecimalInput className="in in--num" aria-label={`Agency fee percent for ${name}`} disabled={!canManage} value={d.afPct} onCommit={afPct=>patch({afPct:Math.max(0,afPct)})} />}
    <div className="num"><b className="mono">{money(client.clientCost)}</b><small className="q-cw-unit">{d.costCurrency}</small>{computed.warning && <span className="chip chip--wrn">{computed.warning}</span>}</div>
    {show("fx") && d.costCurrency!==displayCurrency && <div className="q-cw-fx"><QuotationCreatorFxFields compact draft={d} displayCurrency={displayCurrency} displayFxRateToEgp={displayFxRateToEgp} disabled={!canManage} onChange={patch} /></div>}
  </div>;
}
