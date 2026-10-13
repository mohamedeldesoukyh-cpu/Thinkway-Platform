"use client";

import { useState, type ReactNode } from "react";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { portfolioIntelFromLifecycle } from "@/features/campaigns/lifecycle/campaign-portfolio-intelligence";
import { resolveCampaignDisplayDates, resolveCampaignDisplayPlatform } from "@/lib/campaigns/campaign-workspace-presenters";
import { formatCampaignTargetMarketLabel } from "@/lib/campaigns/target-market";
import { CampaignPoEditSheet } from "@/features/campaigns/components/campaign-po-edit-sheet";
import { formatMoney } from "@/features/campaigns/utils";
import { format, isValid, parseISO } from "date-fns";

function displayDate(value: string | null) {
  if (!value) return "—";
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed,"dd MMM yyyy") : "—";
}

function Info({ title, rows, children }: { title: string; rows: [string, ReactNode][]; children?: ReactNode }) {
  return <article className="wr-overview-info"><h2>{title}</h2><div className="wr-overview-info-body"><dl>{rows.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>{children && <div className="wr-overview-info-actions">{children}</div>}</div></article>;
}

/** Read-only reference summaries. Editing uses the existing platform sheets/callbacks. */
export function CampaignOverviewReferenceDetails({ workspace, lifecycle, currencyOptions, onOpenDetails, onEditHeader, onOpenResolver, onContinueLifecycle }: {
  workspace: CampaignWorkspace; lifecycle?: CampaignLifecycleView;
  currencyOptions: { value: string; label: string }[];
  onOpenDetails?: () => void; onEditHeader: () => void;
  onOpenResolver?: () => void; onContinueLifecycle?: () => void;
}) {
  const [poOpen,setPoOpen] = useState(false);
  const dates = resolveCampaignDisplayDates(workspace);
  const po = workspace.po;
  const intel = lifecycle ? portfolioIntelFromLifecycle(lifecycle,{ endDate: workspace.end_date }) : null;
  return <>
    <div className="wr-overview-info-grid">
      <Info title="Campaign details" rows={[
        ["Client",workspace.client?.name], ["Brand",workspace.brand?.name],
        ["Platforms",resolveCampaignDisplayPlatform(workspace)],
        ["Target market",formatCampaignTargetMarketLabel(workspace.target_market) ?? "Legal entity country (default)"],
        ["Account manager",workspace.account_manager?.full_name ?? workspace.account_manager?.email],
        ["Dates",`${displayDate(dates.start)} — ${displayDate(dates.end)}`], ["Campaign currency",workspace.currency_code]
      ]}><button type="button" onClick={onOpenDetails ?? onEditHeader}>Campaign details</button></Info>
      <Info title="Purchase order" rows={po.po_number || po.po_amount_original > 0 ? [
        ["PO number",po.po_number], ["Original amount",formatMoney(po.po_amount_original,po.po_currency ?? workspace.currency_code)],
        ["Consumed",formatMoney(po.po_consumed_amount,workspace.currency_code)],
        ["Remaining",<>{formatMoney(po.po_remaining_amount,workspace.currency_code)}{po.po_remaining_percent != null && <small>{po.po_remaining_percent.toFixed(1)}% of the PO remains</small>}</>],
        ["Expiry",displayDate(po.po_expiry_date)]
      ] : []}>{!po.po_number && po.po_amount_original <= 0 && <p>No purchase order recorded.</p>}<button type="button" onClick={()=>setPoOpen(true)}>{po.po_number || po.po_amount_original > 0 ? "PO details" : "Record a PO"}</button></Info>
      <Info title="Next required action" rows={[
        ["Stage",lifecycle?.businessStageLabel ?? workspace.workflow_stage],
        ["State",lifecycle?.businessStateLabel ?? workspace.status],
        ["Waiting for",intel?.waitingFor ?? "—"], ["Days waiting",intel?.daysWaitingLabel ?? "—"], ["Risk",intel?.riskLabel ?? "—"]
      ]}>{onContinueLifecycle && <button type="button" onClick={onContinueLifecycle}>{lifecycle?.decisionCenter.primaryAction ?? "Continue"}</button>}{onOpenResolver && <button type="button" onClick={onOpenResolver}>Lifecycle guidance</button>}</Info>
    </div>
    <CampaignPoEditSheet campaignId={workspace.id} campaignName={workspace.name} campaignCurrency={workspace.currency_code} po={po} currencyOptions={currencyOptions} open={poOpen} onOpenChange={setPoOpen}/>
  </>;
}
