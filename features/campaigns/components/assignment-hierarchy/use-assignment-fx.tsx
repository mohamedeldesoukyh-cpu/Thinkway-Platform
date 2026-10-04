"use client";

import { useState } from "react";
import { creatorFxRate, makeCreatorFx, readCreatorFx } from "@/lib/commercial/creator-fx";
import type { CampaignLineWorkspace } from "@/lib/domains/campaign/workspace-types";
import { useCampaignCurrency } from "../campaign-money";
import { updateAssignmentFxAction } from "@/features/campaigns/actions/update-assignment-fx";

type Side = "cost" | "revenue";
type FxDraft = Partial<Record<Side, number | null>>;

export function useAssignmentFx(line: CampaignLineWorkspace | undefined, currency: string, editable: boolean) {
  const workspace = useCampaignCurrency();
  const [drafts, setDrafts] = useState<Record<string, FxDraft>>({});
  const id = line?.id ?? "";
  const draft = drafts[id] ?? {};
  const rates = workspace?.currency_rates ?? {};
  const costCurrency = currency === line?.currency_code ? line?.cost_received_currency || currency : currency;
  const saved = { cost: line?.cost_fx_override ?? null, revenue: line?.revenue_fx_override ?? null };
  const currencies = { cost: costCurrency, revenue: currency };
  const overrides = { ...saved };
  let valid = true;
  for (const side of ["cost", "revenue"] as const) {
    if (draft[side] !== undefined) {
      if (draft[side] !== null && Math.abs(draft[side]! * 1e6 - Math.round(draft[side]! * 1e6)) > 0.001) valid = false;
      try { overrides[side] = draft[side] === null ? null : makeCreatorFx(currencies[side], "EGP", draft[side]!, 1); }
      catch { valid = false; }
    }
  }
  const rate = (side: Side, from = currencies[side]): number | null => {
    try { return creatorFxRate({ from, to: "EGP", sourceRateToEgp: rates[from] ?? 0, targetRateToEgp: 1, override: overrides[side] }); }
    catch { return null; }
  };
  const equivalent = (value: number, side: Side, from = currency) => {
    const fx = rate(side, from);
    return <small className="acp-equivalent">{!valid || fx === null ? "EGP equivalent unavailable" : `≈ EGP ${(Math.round(value * fx * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</small>;
  };
  const controls = (side: Side) => <span className="acp-fx-controls">
    <label>1 {currencies[side]} = <input key={id + side + currency} aria-label={`${side === "cost" ? "Cost" : "Revenue"} FX rate to EGP`} type="number" inputMode="decimal" min="0.000001" max="1000000000" step="0.000001"
      value={draft[side] ?? rate(side) ?? ""} disabled={!editable || currencies[side] === "EGP"}
      onChange={event => setDrafts(previous => ({ ...previous, [id]: { ...previous[id], [side]: Number(event.target.value) } }))} /> EGP</label>
    <small>{draft[side] !== undefined ? draft[side] === null ? "System" : "Custom" : readCreatorFx(saved[side])?.from === currencies[side] ? "Custom" : "System"}</small>
    {currencies[side] !== "EGP" && <button type="button" disabled={!editable} onClick={() => setDrafts(previous => ({ ...previous, [id]: { ...previous[id], [side]: null } }))}>Use system</button>}
  </span>;
  const reset = () => setDrafts(previous => { const next = { ...previous }; delete next[id]; return next; });
  return {
    controls, equivalent, overrides, valid, dirty: Object.keys(draft).length > 0, reset, rates, costCurrency,
    async save(campaignId: string) {
      if (!line || !valid) return { ok: false, message: "Enter positive FX rates with up to six decimal places." };
      return updateAssignmentFxAction({ campaignId, lineId: line.id, costOverride: overrides.cost, revenueOverride: overrides.revenue,
        expectedCostOverride: saved.cost, expectedRevenueOverride: saved.revenue, currency: line.currency_code, costCurrency: line.cost_received_currency || line.currency_code });
    },
  };
}
