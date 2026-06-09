"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DETAIL_FIELD_INPUT_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_FIELD_SELECT_TRIGGER_CLASS,
  DetailEditBlock,
  DetailEditField,
  DetailField,
  DetailPanelHeader,
  DetailPill,
  DetailSheetFooter,
  DetailTabList,
  DETAIL_TAB_TRIGGER_CLASS,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import type { CampaignPoSummary } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import {
  updateCampaignPoAction,
  type FinanceActionState,
} from "@/features/finance/exchange-rates/actions";
import {
  PO_STATUS_LABELS,
  getPoHealthColor,
} from "@/lib/finance/po/status";
import { cn } from "@/lib/utils";

type CampaignPoEditSheetProps = {
  campaignId: string;
  campaignName: string;
  campaignCurrency: string;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function PoGeneralTab({
  po,
  campaignCurrency,
}: {
  po: CampaignPoSummary;
  campaignCurrency: string;
}) {
  const consumedPct = useMemo(() => {
    if (po.po_amount_campaign_currency <= 0) return 0;
    return Math.min(100, (po.po_consumed_amount / po.po_amount_campaign_currency) * 100);
  }, [po.po_amount_campaign_currency, po.po_consumed_amount]);

  const poCurrency = po.po_currency ?? campaignCurrency;

  return (
    <div className="px-1">
      <DetailField label="PO status">
        <DetailPill>{PO_STATUS_LABELS[po.po_status]}</DetailPill>
      </DetailField>
      <DetailField label="PO number">{po.po_number ?? "—"}</DetailField>
      <DetailField label="PO amount">
        {formatMoney(po.po_amount_original, poCurrency)}
      </DetailField>
      <DetailField label="PO currency">
        <DetailPill>{poCurrency}</DetailPill>
      </DetailField>
      <DetailField label="FX rate">
        {po.po_exchange_rate != null
          ? `1 ${poCurrency} = ${po.po_exchange_rate.toFixed(4)} ${campaignCurrency}`
          : "—"}
      </DetailField>
      <DetailField label="Converted PO">
        {formatMoney(po.po_amount_campaign_currency, campaignCurrency)}
      </DetailField>
      <DetailField label="Consumed">
        {formatMoney(po.po_consumed_amount, campaignCurrency)}
      </DetailField>
      <DetailField label="Remaining">
        {formatMoney(po.po_remaining_amount, campaignCurrency)}
      </DetailField>
      <DetailField label="Remaining %">
        {po.po_remaining_percent != null ? formatPercent(po.po_remaining_percent) : "—"}
      </DetailField>
      <DetailField label="Expiry">{po.po_expiry_date ?? "—"}</DetailField>
      <DetailField label="Override approved">
        {po.po_override_approved ? "Yes" : "No"}
      </DetailField>
      {po.po_override_reason ? (
        <DetailField label="Override reason" valueClassName="max-w-[60%] text-left">
          {po.po_override_reason}
        </DetailField>
      ) : null}
      <DetailField label="FX snapshot">
        {po.fx_snapshot_at ? new Date(po.fx_snapshot_at).toLocaleString() : "—"}
      </DetailField>
      {po.po_amount_campaign_currency > 0 ? (
        <div className="border-b border-border/40 py-3.5 last:border-b-0">
          <p className={DETAIL_FIELD_LABEL_CLASS}>PO consumption</p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Utilization</span>
              <span>{consumedPct.toFixed(1)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-all", getPoHealthColor(po.health))}
                style={{ width: `${consumedPct}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PoEditFields({
  po,
  campaignCurrency,
  currencyOptions,
  poCurrency,
  onPoCurrencyChange,
  pending,
}: {
  po: CampaignPoSummary;
  campaignCurrency: string;
  currencyOptions: { value: string; label: string }[];
  poCurrency: string;
  onPoCurrencyChange: (value: string) => void;
  pending: boolean;
}) {
  return (
    <div className="px-1">
      <DetailEditField label="PO number">
        <Input
          id="po_number"
          name="po_number"
          className={cn(DETAIL_FIELD_INPUT_CLASS, "text-right tabular-nums")}
          defaultValue={po.po_number ?? ""}
          disabled={pending}
        />
      </DetailEditField>
      <DetailEditField label="PO currency" align="start">
        <Select value={poCurrency} onValueChange={onPoCurrencyChange} disabled={pending}>
          <SelectTrigger id="po_currency" className={DETAIL_FIELD_SELECT_TRIGGER_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DetailEditField>
      <DetailEditField label="PO amount">
        <Input
          id="po_amount_original"
          name="po_amount_original"
          type="number"
          min={0}
          step="0.01"
          className={cn(DETAIL_FIELD_INPUT_CLASS, "text-right tabular-nums")}
          defaultValue={po.po_amount_original}
          disabled={pending}
        />
      </DetailEditField>
      <DetailEditField label={`FX rate (${campaignCurrency})`}>
        <Input
          id="po_exchange_rate"
          name="po_exchange_rate"
          type="number"
          min={0}
          step="0.000001"
          className={cn(DETAIL_FIELD_INPUT_CLASS, "text-right tabular-nums")}
          defaultValue={po.po_exchange_rate ?? 1}
          disabled={pending}
        />
      </DetailEditField>
      <DetailEditField label="PO expiry" align="start">
        <Input
          id="po_expiry_date"
          name="po_expiry_date"
          type="date"
          className={DETAIL_FIELD_INPUT_CLASS}
          defaultValue={po.po_expiry_date ?? ""}
          disabled={pending}
        />
      </DetailEditField>
      <DetailEditBlock label="Change reason">
        <Textarea
          id="override_reason"
          name="override_reason"
          rows={3}
          disabled={pending}
          className="min-h-[4.5rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1"
          placeholder="Optional note for PO governance log"
        />
      </DetailEditBlock>
    </div>
  );
}

export function CampaignPoEditSheet({
  campaignId,
  campaignName,
  campaignCurrency,
  po,
  currencyOptions,
  open,
  onOpenChange,
}: CampaignPoEditSheetProps) {
  const [poCurrency, setPoCurrency] = useState(po.po_currency ?? campaignCurrency);
  const [state, formAction, pending] = useActionState(updateCampaignPoAction, {
    ok: false,
  } satisfies FinanceActionState);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setPoCurrency(po.po_currency ?? campaignCurrency);
  }, [open, po.po_currency, campaignCurrency]);

  const title = po.po_number?.trim() || "Client PO";

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${title} PO details`}
      description={`Client PO governance for ${campaignName}`}
    >
      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="po_currency" value={poCurrency} />

        <DetailPanelHeader
          breadcrumb={
            <>
              {campaignName}
              <span className="text-muted-foreground/60"> / </span>
              <span className="text-foreground/80">{title}</span>
            </>
          }
          avatarInitials="PO"
          title={title}
          badges={
            <>
              <DetailPill>{PO_STATUS_LABELS[po.po_status]}</DetailPill>
              {po.po_override_approved ? (
                <Badge variant="destructive" className="text-[10px]">
                  Override approved
                </Badge>
              ) : null}
              {po.fx_snapshot_at ? (
                <DetailPill>FX snapshot preserved</DetailPill>
              ) : null}
              <DetailPill>
                {formatMoney(po.po_consumed_amount, campaignCurrency)} consumed
              </DetailPill>
            </>
          }
        />

        <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
          <DetailTabList>
            <TabsList
              variant="line"
              className="h-auto w-full justify-start gap-4 rounded-none bg-transparent p-0"
            >
              <TabsTrigger value="general" className={DETAIL_TAB_TRIGGER_CLASS}>
                General
              </TabsTrigger>
              <TabsTrigger value="edit" className={DETAIL_TAB_TRIGGER_CLASS}>
                Edit
              </TabsTrigger>
            </TabsList>
          </DetailTabList>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="general" className="mt-0 outline-none">
              <PoGeneralTab po={po} campaignCurrency={campaignCurrency} />
            </TabsContent>
            <TabsContent value="edit" className="mt-0 outline-none">
              <PoEditFields
                po={po}
                campaignCurrency={campaignCurrency}
                currencyOptions={currencyOptions}
                poCurrency={poCurrency}
                onPoCurrencyChange={setPoCurrency}
                pending={pending}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DetailSheetFooter hint="Updates create PO governance logs. FX snapshot is preserved on save.">
          <Button size="sm" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save PO"}
          </Button>
        </DetailSheetFooter>
      </form>
    </OperationalDetailSheet>
  );
}
