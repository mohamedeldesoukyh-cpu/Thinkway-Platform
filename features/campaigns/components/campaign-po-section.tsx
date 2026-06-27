"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignPoEditSheet } from "@/features/campaigns/components/campaign-po-edit-sheet";
import {
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
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
      <CampaignFlatSection
        title="Client PO governance"
        description="Consumption uses billable base (Revenue + UR Rev + AF). VAT never affects PO utilization."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
            onClick={() => setEditOpen(true)}
          >
            <PencilIcon data-icon="inline-start" className="size-3.5" />
            Edit PO
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={PO_STATUS_VARIANT[po.po_status]}>
              {PO_STATUS_LABELS[po.po_status]}
            </Badge>
            {po.po_override_approved ? (
              <Badge variant="destructive">Override approved</Badge>
            ) : null}
            {po.fx_snapshot_at ? (
              <Badge variant="outline">FX snapshot preserved</Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="PO number" value={po.po_number ?? "—"} />
            <Metric
              label="PO amount"
              value={formatMoney(po.po_amount_original, po.po_currency ?? campaignCurrency)}
              valueClassName="thinkway-campaign-c-amber"
            />
            <Metric label="PO currency" value={po.po_currency ?? campaignCurrency} />
            <Metric
              label="FX rate"
              value={
                po.po_exchange_rate != null
                  ? `1 ${po.po_currency ?? campaignCurrency} = ${po.po_exchange_rate.toFixed(4)} ${campaignCurrency}`
                  : "—"
              }
            />
            <Metric
              label="Converted PO"
              value={formatMoney(po.po_amount_campaign_currency, campaignCurrency)}
            />
            <Metric
              label="Consumed"
              value={formatMoney(po.po_consumed_amount, campaignCurrency)}
              valueClassName="thinkway-campaign-c-amber"
            />
            <Metric
              label="Remaining"
              value={formatMoney(po.po_remaining_amount, campaignCurrency)}
            />
            <Metric
              label="Remaining %"
              value={
                po.po_remaining_percent != null
                  ? formatPercent(po.po_remaining_percent)
                  : "—"
              }
            />
            <Metric label="Expiry" value={po.po_expiry_date ?? "—"} />
          </div>

          {po.po_amount_campaign_currency > 0 ? (
            <div className="space-y-1.5">
              <div className="thinkway-campaign-field-label mb-1">
                PO consumption · {consumedPct.toFixed(1)}% utilized
              </div>
              <div className="thinkway-campaign-po-progress-bar">
                <div
                  className={cn("thinkway-campaign-po-progress-fill transition-all", getPoHealthColor(po.health))}
                  style={{ width: `${consumedPct}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </CampaignFlatSection>

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

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="thinkway-campaign-field-label">{label}</div>
      <div className={cn("thinkway-campaign-field-val tabular-nums", valueClassName)}>{value}</div>
    </div>
  );
}
