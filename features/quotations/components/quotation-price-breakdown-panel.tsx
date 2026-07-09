"use client";

import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { CopyIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CommercialInputMode,
} from "@/lib/commercial/commercial-engine";
import {
  COMMERCIAL_CURRENCIES,
  formatDualCurrency,
} from "@/lib/commercial/fx-aggregation";
import {
  addQuotationItemOption,
  duplicateQuotationItems,
  returnQuotationItemToShortlist,
  updateQuotationItemCommercials,
} from "@/features/quotations/actions";
import { COMMERCIAL_INPUT_MODE_LABELS, QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import { gpHealthTextClass } from "@/features/quotations/quotation-gp-health";
import {
  computeQuotationRowComputed,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/features/quotations/types";
import { useDebouncedAutosave } from "@/lib/hooks/use-debounced-autosave";
import { cn } from "@/lib/utils";

function egp(n: number, decimals = 0): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0)} EGP`;
}

function parseNum(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

type Props = {
  quotationId: string;
  shortlistId: string | null;
  item: QuotationItemRow;
  draft: QuotationRowDraft | undefined;
  gpTargetPct: number;
  expanded: boolean;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onChanged: () => void;
};

export function QuotationPriceBreakdownPanel({
  quotationId,
  shortlistId,
  item,
  draft,
  gpTargetPct,
  expanded,
  onDraftChange,
  onChanged,
}: Props) {
  const [pending, startTransition] = useTransition();
  const revenueRef = useRef<HTMLInputElement>(null);
  const gpPctRef = useRef<HTMLInputElement>(null);

  const mode = draft?.mode ?? item.commercial_input_mode;
  const cost = draft?.cost ?? item.cost;
  const costCurrency = draft?.costCurrency ?? item.cost_currency;
  const gpPct = draft?.gpPct ?? item.gp_pct;
  const revenue = draft?.revenue ?? item.revenue;
  const gpValue = draft?.gpValue ?? item.gp_value;
  const afPct = draft?.afPct ?? item.af_pct;
  const fxRate = draft?.fxRateToEgp ?? item.fx_rate_to_egp;

  const computed = useMemo(
    () =>
      computeQuotationRowComputed({
        id: item.id,
        mode,
        cost,
        costCurrency,
        gpPct,
        revenue,
        gpValue,
        afPct,
        fxRateToEgp: fxRate,
      }),
    [item.id, mode, cost, costCurrency, gpPct, revenue, gpValue, afPct, fxRate]
  );

  const { schedule } = useDebouncedAutosave<{
    mode: CommercialInputMode;
    cost: number | null;
    cost_currency: string;
    gp_pct?: number | null;
    revenue?: number | null;
    gp_value?: number | null;
    af_pct?: number | null;
  }>(async (payload) => {
    const res = await updateQuotationItemCommercials({
      item_id: item.id,
      quotation_id: quotationId,
      ...payload,
    });
    if (res.ok && res.data?.fx_rate_to_egp != null) {
      onDraftChange(item.id, { fxRateToEgp: res.data.fx_rate_to_egp });
    }
    return res;
  });

  const triggerSave = useCallback(
    (patch: Partial<QuotationRowDraft>) => {
      const next = {
        mode: patch.mode ?? mode,
        cost: patch.cost ?? cost,
        costCurrency: patch.costCurrency ?? costCurrency,
        gpPct: patch.gpPct ?? gpPct,
        revenue: patch.revenue ?? revenue,
        gpValue: patch.gpValue ?? gpValue,
        afPct: patch.afPct ?? afPct,
        fxRateToEgp:
          patch.costCurrency && patch.costCurrency !== "EGP" && patch.costCurrency !== costCurrency
            ? 1
            : fxRate,
      };
      onDraftChange(item.id, next);
      schedule({
        mode: next.mode,
        cost: next.cost,
        cost_currency: next.costCurrency,
        gp_pct: next.gpPct,
        revenue: next.revenue,
        gp_value: next.gpValue,
        af_pct: next.afPct,
      });
    },
    [
      mode,
      cost,
      costCurrency,
      gpPct,
      revenue,
      gpValue,
      afPct,
      fxRate,
      item.id,
      onDraftChange,
      schedule,
    ]
  );

  const gpClass = gpHealthTextClass({
    gpValueEgp: computed.gpValueEgp,
    gpPct: computed.gpPct,
    targetPct: gpTargetPct,
  });

  function handleDuplicateLine() {
    startTransition(async () => {
      const res = await duplicateQuotationItems({
        quotation_id: quotationId,
        item_ids: [item.id],
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Line duplicated.");
      onChanged();
    });
  }

  function handleAddOption() {
    startTransition(async () => {
      const res = await addQuotationItemOption({
        quotation_id: quotationId,
        item_id: item.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Option added.");
      onChanged();
    });
  }

  function handleReturnToShortlist() {
    if (!shortlistId) {
      toast.error("This quotation is not linked to a shortlist.");
      return;
    }
    startTransition(async () => {
      const res = await returnQuotationItemToShortlist({
        quotation_id: quotationId,
        item_id: item.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Creator returned to shortlist.");
      onChanged();
    });
  }

  if (!expanded) return null;

  return (
    <div className="border-t border-border/60 bg-muted/15 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-1.5">
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="h-7 text-[11px]"
          disabled={pending}
          onClick={handleAddOption}
        >
          <PlusIcon className="size-3" />
          Add option
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="h-7 text-[11px]"
          disabled={pending}
          onClick={handleDuplicateLine}
        >
          <CopyIcon className="size-3" />
          Duplicate line
        </Button>
        {shortlistId ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={pending}
            onClick={handleReturnToShortlist}
          >
            <RotateCcwIcon className="size-3" />
            Return to shortlist
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Field label="Unit cost">
          <Input
            className="h-8 text-xs"
            inputMode="decimal"
            value={String(cost || "")}
            onChange={(e) => triggerSave({ cost: parseNum(e.target.value) })}
          />
        </Field>
        <Field label="Currency">
          <Select value={costCurrency} onValueChange={(v) => triggerSave({ costCurrency: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMERCIAL_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Calculation">
          <Select
            value={mode}
            onValueChange={(v) => triggerSave({ mode: v as CommercialInputMode })}
          >
            <SelectTrigger className="h-8 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COMMERCIAL_INPUT_MODE_LABELS) as CommercialInputMode[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {COMMERCIAL_INPUT_MODE_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={QUOTATION_CLIENT_LABELS.clientCost}>
          {mode === "cost_revenue" ? (
            <Input
              ref={revenueRef}
              className="h-8 text-xs"
              inputMode="decimal"
              value={String(revenue || "")}
              onChange={(e) => triggerSave({ revenue: parseNum(e.target.value) })}
            />
          ) : (
            <p className="pt-1.5 text-xs tabular-nums">
              {formatDualCurrency({
                amount: computed.revenue,
                currency: costCurrency,
                egpAmount: computed.revenueEgp,
              })}
            </p>
          )}
        </Field>
        <Field label="GP">
          {mode === "cost_gp_value" ? (
            <Input
              className="h-8 text-xs"
              inputMode="decimal"
              value={String(gpValue || "")}
              onChange={(e) => triggerSave({ gpValue: parseNum(e.target.value) })}
            />
          ) : (
            <p className={cn("pt-1.5 text-xs tabular-nums", gpClass)}>{egp(computed.gpValueEgp)}</p>
          )}
        </Field>
        <Field label="GP%">
          {mode === "cost_gp_pct" || mode === "cost_markup_pct" ? (
            <div className="flex items-center gap-1">
              <Input
                ref={gpPctRef}
                className="h-8 text-xs"
                inputMode="decimal"
                value={String(gpPct || "")}
                onChange={(e) => triggerSave({ gpPct: parseNum(e.target.value) })}
              />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          ) : (
            <p className={cn("pt-1.5 text-xs tabular-nums", gpClass)}>
              {computed.gpPct.toFixed(1)}%
            </p>
          )}
        </Field>
        <Field label="AF%">
          <div className="flex items-center gap-1">
            <Input
              className="h-8 text-xs"
              inputMode="decimal"
              value={String(afPct || "")}
              onChange={(e) => triggerSave({ afPct: parseNum(e.target.value) })}
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
        </Field>
        <Field label="AF">
          <p className="pt-1.5 text-xs tabular-nums">{egp(computed.afValueEgp, 2)}</p>
        </Field>
        <Field label={QUOTATION_CLIENT_LABELS.totalAgencyMargin}>
          <p className="pt-1.5 text-xs font-semibold tabular-nums">
            {egp(computed.agencyMarginEgp, 2)}
          </p>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
