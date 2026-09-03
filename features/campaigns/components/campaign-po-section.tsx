"use client";

import { useState } from "react";

import {
  CampaignOpsCard,
  CampaignOpsStat,
} from "@/features/campaigns/components/aurora/campaign-ops-card";
import { CampaignPoEditSheet } from "@/features/campaigns/components/campaign-po-edit-sheet";
import {
  PO_STATUS_LABELS,
  getPoHealthColor,
} from "@/lib/finance/po/status";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import type { CampaignPoSummary } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

type CampaignPoSectionProps = {
  campaignId: string;
  campaignName: string;
  campaignCurrency: string;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
};

function pill(tone: "green" | "blue" | "amber" | "rose" | "mut", label: string) {
  return (
    <span
      className={cn(
        "thinkway-aurora-pill h-5 text-[10.5px]",
        tone === "green" && "thinkway-aurora-pill-green",
        tone === "blue" && "thinkway-aurora-pill-blue",
        tone === "amber" && "thinkway-aurora-pill-amber",
        tone === "rose" && "thinkway-aurora-pill-rose",
        tone === "mut" && "thinkway-aurora-pill-mut"
      )}
    >
      {label}
    </span>
  );
}

function poTone(
  status: CampaignPoSummary["po_status"]
): "green" | "blue" | "amber" | "rose" | "mut" {
  if (status === "active" || status === "closed") return "green";
  if (status === "near_limit" || status === "draft") return "amber";
  if (status === "exceeded" || status === "expired") return "rose";
  return "mut";
}

export function CampaignPoSection({
  campaignId,
  campaignName,
  campaignCurrency,
  po,
  currencyOptions,
}: CampaignPoSectionProps) {
  const [editOpen, setEditOpen] = useState(false);
  const consumedPct =
    po.po_amount_campaign_currency > 0
      ? Math.min(
          100,
          (po.po_consumed_amount / po.po_amount_campaign_currency) * 100
        )
      : 0;

  return (
    <>
      <CampaignOpsCard
        title="Client PO governance"
        subtitle="Consumption uses billable base (Revenue + UR Rev + AF)"
        className={
          po.po_status === "exceeded" || po.po_status === "expired"
            ? "is-alert"
            : undefined
        }
        status={pill(poTone(po.po_status), PO_STATUS_LABELS[po.po_status])}
        actionLabel="Edit PO"
        onAction={() => setEditOpen(true)}
      >
        <CampaignOpsStat label="PO number" value={po.po_number ?? "—"} />
        <CampaignOpsStat
          label="PO amount"
          value={formatMoney(po.po_amount_original, po.po_currency ?? campaignCurrency)}
          tone="amber"
        />
        <CampaignOpsStat
          label="PO currency"
          value={po.po_currency ?? campaignCurrency}
        />
        <CampaignOpsStat
          label="FX rate"
          value={
            po.po_exchange_rate != null
              ? `1 ${po.po_currency ?? campaignCurrency} = ${po.po_exchange_rate.toFixed(4)} ${campaignCurrency}`
              : "—"
          }
        />
        <CampaignOpsStat
          label="Converted PO"
          value={formatMoney(po.po_amount_campaign_currency, campaignCurrency)}
        />
        <CampaignOpsStat
          label="Consumed"
          value={formatMoney(po.po_consumed_amount, campaignCurrency)}
          tone="amber"
        />
        <CampaignOpsStat
          label="Remaining"
          value={formatMoney(po.po_remaining_amount, campaignCurrency)}
        />
        <CampaignOpsStat
          label="Remaining %"
          value={
            po.po_remaining_percent != null
              ? formatPercent(po.po_remaining_percent)
              : "—"
          }
        />
        <CampaignOpsStat label="Expiry" value={po.po_expiry_date ?? "—"} />
        {po.po_override_approved ? (
          <CampaignOpsStat label="Override" value="Approved" tone="amber" />
        ) : null}
        {po.fx_snapshot_at ? (
          <CampaignOpsStat label="FX snapshot" value="Preserved" tone="mut" />
        ) : null}
        {po.po_amount_campaign_currency > 0 ? (
          <div className="space-y-1.5 border-t border-[var(--tw-hair)] px-[15px] py-2.5">
            <div className="text-[11px] text-[var(--tw-mut)]">
              PO consumption · {consumedPct.toFixed(1)}% utilized
            </div>
            <div className="thinkway-campaign-po-progress-bar">
              <div
                className={cn(
                  "thinkway-campaign-po-progress-fill transition-all",
                  getPoHealthColor(po.health)
                )}
                style={{ width: `${consumedPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </CampaignOpsCard>

      <CampaignPoEditSheet
        campaignId={campaignId}
        campaignName={campaignName}
        campaignCurrency={campaignCurrency}
        po={po}
        currencyOptions={currencyOptions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
