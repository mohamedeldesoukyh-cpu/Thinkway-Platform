"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CommercialInputMode } from "@/lib/commercial/commercial-engine";
import {
  COMMERCIAL_CURRENCIES,
  formatDualCurrency,
} from "@/lib/commercial/fx-aggregation";
import { COMMERCIAL_INPUT_MODE_LABELS, QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import {
  computeDeliverableClientPrice,
  deliverableCommercialDefaults,
  QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE,
  withDeliverableCommercialPatch,
} from "@/lib/quotations/quotation-deliverable-commercial";
import { deliverableSnapshot } from "@/lib/quotations/quotation-line-pending-diff";
import { deliverableLineCost } from "@/lib/quotations/quotation-deliverable-rollup";
import {
  formatNumDisplay,
  mergePastedNumericText,
  parseDecimalInput,
  parseUnitsInput,
} from "@/lib/quotations/quotation-numeric-input";
import { computeCommercials } from "@/lib/commercial/commercial-engine";

function stopShortcutBubble(event: React.KeyboardEvent) {
  event.stopPropagation();
}

function DraftDecimalInput({
  value,
  onCommit,
  ...props
}: {
  value: number;
  onCommit: (next: number) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  const [text, setText] = useState(() => formatNumDisplay(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(formatNumDisplay(value));
  }, [value]);

  return (
    <Input
      {...props}
      value={text}
      onFocus={(event) => {
        focusedRef.current = true;
        props.onFocus?.(event);
      }}
      onChange={(event) => setText(event.target.value)}
      onBlur={(event) => {
        focusedRef.current = false;
        const parsed = parseDecimalInput(text);
        onCommit(parsed);
        setText(formatNumDisplay(parsed));
        props.onBlur?.(event);
      }}
      onKeyDown={(event) => {
        stopShortcutBubble(event);
        props.onKeyDown?.(event);
      }}
      onPaste={(event) => {
        event.stopPropagation();
        event.preventDefault();
        const target = event.currentTarget;
        setText((current) =>
          mergePastedNumericText(
            current,
            event.clipboardData.getData("text"),
            target.selectionStart,
            target.selectionEnd
          )
        );
        props.onPaste?.(event);
      }}
    />
  );
}

function DraftUnitsInput({
  value,
  onCommit,
  ...props
}: {
  value: number;
  onCommit: (next: number) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  const [text, setText] = useState(() => formatNumDisplay(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(formatNumDisplay(value));
  }, [value]);

  return (
    <Input
      {...props}
      value={text}
      onFocus={(event) => {
        focusedRef.current = true;
        props.onFocus?.(event);
      }}
      onChange={(event) => setText(event.target.value)}
      onBlur={(event) => {
        focusedRef.current = false;
        const parsed = parseUnitsInput(text);
        onCommit(parsed);
        setText(formatNumDisplay(parsed));
        props.onBlur?.(event);
      }}
      onKeyDown={(event) => {
        stopShortcutBubble(event);
        props.onKeyDown?.(event);
      }}
      onPaste={(event) => {
        event.stopPropagation();
        event.preventDefault();
        const target = event.currentTarget;
        setText((current) =>
          mergePastedNumericText(
            current,
            event.clipboardData.getData("text"),
            target.selectionStart,
            target.selectionEnd
          )
        );
        props.onPaste?.(event);
      }}
    />
  );
}

type Props = {
  deliverable: QuotationDeliverable;
  item: QuotationItemRow;
  draft: QuotationRowDraft | undefined;
  onApply: (next: QuotationDeliverable) => void;
  /** When set, price and trigger render on one line (price first, then Cost details). */
  priceLabel?: string;
  gpPctLabel?: string | null;
};

export function QuotationDeliverableCostDetails({
  deliverable,
  item,
  draft,
  onApply,
  priceLabel,
  gpPctLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [localDeliverable, setLocalDeliverable] = useState(deliverable);
  const localDeliverableRef = useRef(deliverable);
  const openSnapshotRef = useRef<string | null>(null);
  const fxRate = draft?.fxRateToEgp ?? item.fx_rate_to_egp ?? 1;

  useEffect(() => {
    localDeliverableRef.current = localDeliverable;
  }, [localDeliverable]);

  useEffect(() => {
    if (!open) {
      setLocalDeliverable(deliverable);
      localDeliverableRef.current = deliverable;
    }
  }, [deliverable, open]);

  const defaults = useMemo(() => deliverableCommercialDefaults(item), [item]);

  const mode =
    localDeliverable.commercial_input_mode ??
    defaults.commercial_input_mode ??
    QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE;
  const cost = localDeliverable.cost ?? defaults.cost ?? 0;
  const units = Math.max(1, Math.floor(Number(localDeliverable.quantity) || 1));
  const costCurrency = localDeliverable.cost_currency ?? defaults.cost_currency ?? "EGP";
  const gpPct = localDeliverable.gp_pct ?? defaults.gp_pct ?? 0;
  const gpValue = localDeliverable.gp_value ?? defaults.gp_value ?? 0;
  const afPct = localDeliverable.af_pct ?? defaults.af_pct ?? 0;

  const computedRevenue = useMemo(
    () => computeDeliverableClientPrice(localDeliverable, fxRate),
    [localDeliverable, fxRate]
  );

  const computedGp = useMemo(() => {
    const lineCost = deliverableLineCost(localDeliverable);
    return computeCommercials({
      mode: "cost_revenue",
      cost: lineCost,
      revenue: computedRevenue,
    });
  }, [localDeliverable, computedRevenue]);

  function patchLocal(partial: Partial<QuotationDeliverable>) {
    setLocalDeliverable((prev) => withDeliverableCommercialPatch(prev, partial, fxRate));
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      const normalized = withDeliverableCommercialPatch(deliverable, {}, fxRate);
      setLocalDeliverable(normalized);
      localDeliverableRef.current = normalized;
      openSnapshotRef.current = deliverableSnapshot(normalized);
      setOpen(true);
      return;
    }
    setOpen(false);
    const patched = withDeliverableCommercialPatch(localDeliverableRef.current, {}, fxRate);
    if (
      openSnapshotRef.current != null &&
      openSnapshotRef.current !== deliverableSnapshot(patched)
    ) {
      onApply(patched);
    }
    openSnapshotRef.current = null;
  }

  const trigger = (
    <Button
      type="button"
      variant="link"
      className="h-auto min-h-6 shrink-0 px-0 py-0.5 text-xs font-bold whitespace-nowrap text-destructive underline underline-offset-2 hover:text-destructive/90"
    >
      +Cost detail
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {priceLabel != null ? (
        <div className="inline-flex max-w-none flex-col items-end gap-0.5 whitespace-nowrap py-0.5">
          <div className="inline-flex items-center justify-end gap-2.5">
            {priceLabel !== "—" ? (
              <span className="text-sm font-semibold tabular-nums text-foreground">{priceLabel}</span>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </div>
          {gpPctLabel ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">{gpPctLabel} GP</span>
          ) : null}
        </div>
      ) : (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      )}
      <PopoverContent
        align="end"
        className="w-[min(100vw-2rem,22rem)] p-3"
        onKeyDown={stopShortcutBubble}
      >
        <p className="mb-3 text-[11px] font-semibold text-foreground">Cost details</p>
        <p className="mb-2 text-[10px] text-muted-foreground">
          Applied when you close this panel. Click Save on the quotation to persist.
        </p>
        <div className="grid gap-2.5">
          <Field label="Unit cost">
            <DraftDecimalInput
              className="h-8 text-xs"
              inputMode="decimal"
              value={cost}
              onCommit={(next) => patchLocal({ cost: next })}
            />
          </Field>
          <Field label="Pricing units">
            <DraftUnitsInput
              className="h-8 text-xs"
              inputMode="numeric"
              min={1}
              step={1}
              value={units}
              onCommit={(next) => patchLocal({ quantity: next })}
            />
          </Field>
          <Field label="Currency">
            <Select value={costCurrency} onValueChange={(v) => patchLocal({ cost_currency: v })}>
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
              onValueChange={(v) =>
                patchLocal({ commercial_input_mode: v as CommercialInputMode })
              }
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
          {mode === "cost_revenue" ? (
            <Field label={QUOTATION_CLIENT_LABELS.clientCost}>
              <DraftDecimalInput
                className="h-8 text-xs"
                inputMode="decimal"
                value={localDeliverable.revenue ?? 0}
                onCommit={(next) => patchLocal({ revenue: next })}
              />
            </Field>
          ) : (
            <Field label={QUOTATION_CLIENT_LABELS.clientCost}>
              <p className="pt-1 text-xs tabular-nums text-foreground">
                {formatDualCurrency({
                  amount: computedRevenue,
                  currency: costCurrency,
                  egpAmount:
                    costCurrency === "EGP" ? computedRevenue : computedRevenue * fxRate,
                })}
              </p>
              {units > 1 ? (
                <p className="text-[10px] text-muted-foreground">
                  {units} units × unit cost {new Intl.NumberFormat("en-US").format(cost)} {costCurrency}
                </p>
              ) : null}
            </Field>
          )}
          {mode === "cost_gp_value" ? (
            <Field label="GP">
              <DraftDecimalInput
                className="h-8 text-xs"
                inputMode="decimal"
                value={gpValue}
                onCommit={(next) => patchLocal({ gp_value: next })}
              />
            </Field>
          ) : null}
          {mode === "cost_revenue" ? (
            <Field label="GP%">
              <p className="pt-1 text-xs tabular-nums text-foreground">
                {computedRevenue > 0 ? `${computedGp.gpPct.toFixed(1)}%` : "—"}
              </p>
            </Field>
          ) : null}
          {mode === "cost_gp_pct" || mode === "cost_markup_pct" ? (
            <Field label="GP%">
              <div className="flex items-center gap-1">
                <DraftDecimalInput
                  className="h-8 text-xs"
                  inputMode="decimal"
                  value={gpPct}
                  onCommit={(next) => patchLocal({ gp_pct: next })}
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            </Field>
          ) : null}
          <Field label="AF%">
            <div className="flex items-center gap-1">
              <DraftDecimalInput
                className="h-8 text-xs"
                inputMode="decimal"
                value={afPct}
                onCommit={(next) => patchLocal({ af_pct: next })}
              />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          </Field>
        </div>
      </PopoverContent>
    </Popover>
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
