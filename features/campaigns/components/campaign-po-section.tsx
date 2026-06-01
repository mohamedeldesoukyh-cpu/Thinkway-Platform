"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  campaignCurrency: string;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
};

export function CampaignPoSection({
  campaignId,
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Client PO governance</CardTitle>
            <p className="text-sm text-muted-foreground">
              Consumption uses assignment revenue before VAT. VAT never affects PO utilization.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <PencilIcon data-icon="inline-start" />
            Edit PO
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
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

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="PO number" value={po.po_number ?? "—"} />
            <Metric
              label="PO amount"
              value={formatMoney(po.po_amount_original, po.po_currency ?? campaignCurrency)}
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
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>PO consumption</span>
                <span>{consumedPct.toFixed(1)}% utilized</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full transition-all", getPoHealthColor(po.health))}
                  style={{ width: `${consumedPct}%` }}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CampaignPoEditSheet
        campaignId={campaignId}
        campaignCurrency={campaignCurrency}
        po={po}
        currencyOptions={currencyOptions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
