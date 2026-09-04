"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DISCOVERY_DIALOG_INPUT_CLASS,
  DISCOVERY_DIALOG_SELECT_CONTENT_CLASS,
  DISCOVERY_DIALOG_SELECT_ITEM_CLASS,
} from "@/features/discovery/components/design-system/discovery-dialog-chrome";
import { COMMERCIAL_INPUT_MODE_LABELS, QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import {
  computeDeliverableClientPrice,
  computeDeliverableTotalClientCost,
  deliverableCommercialDefaults,
  isDeliverableFreeForClient,
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
import { cn } from "@/lib/utils";

function stopShortcutBubble(event: React.KeyboardEvent) {
  event.stopPropagation();
}

type CostNavDirection = "up" | "down" | "left" | "right";

type CostNavCell = {
  focusable: HTMLElement;
  centerX: number;
  centerY: number;
};

function getCostNavCells(container: HTMLElement): CostNavCell[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-cost-nav-field]"))
    .filter((field) => field.offsetParent !== null)
    .flatMap((field) => {
      const focusable = field.querySelector<HTMLElement>(
        'input:not([disabled]), [data-slot="select-trigger"], [role="checkbox"]'
      );
      if (!focusable) return [];

      const rect = field.getBoundingClientRect();
      return [
        {
          focusable,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        },
      ];
    });
}

function resolveCostNavCell(
  cells: CostNavCell[],
  current: HTMLElement
): CostNavCell | undefined {
  return cells.find(
    (cell) =>
      cell.focusable === current ||
      cell.focusable.contains(current) ||
      current.contains(cell.focusable)
  );
}

function findCostNavTarget(
  cells: CostNavCell[],
  current: HTMLElement,
  direction: CostNavDirection
): HTMLElement | null {
  const active = resolveCostNavCell(cells, current);
  if (!active) return null;

  const { centerX, centerY } = active;
  const others = cells.filter((cell) => cell.focusable !== active.focusable);

  const alignedPrimary = (a: CostNavCell, b: CostNavCell) => {
    if (direction === "left" || direction === "right") {
      return Math.abs(a.centerY - centerY) - Math.abs(b.centerY - centerY);
    }
    return Math.abs(a.centerX - centerX) - Math.abs(b.centerX - centerX);
  };

  const forwardDistance = (cell: CostNavCell) => {
    if (direction === "right") return cell.centerX - centerX;
    if (direction === "left") return centerX - cell.centerX;
    if (direction === "down") return cell.centerY - centerY;
    return centerY - cell.centerY;
  };

  const candidates = others
    .filter((cell) => forwardDistance(cell) > 4)
    .sort((a, b) => {
      const alignment = alignedPrimary(a, b);
      if (Math.abs(alignment) > 6) return alignment;
      return forwardDistance(a) - forwardDistance(b);
    });

  return candidates[0]?.focusable ?? null;
}

function focusCostNavTarget(target: HTMLElement) {
  target.focus();
  if (target instanceof HTMLInputElement) {
    target.select();
  }
}

function handleCostFieldArrowNav(
  event: React.KeyboardEvent,
  container: HTMLElement | null
): boolean {
  const directionKey = event.key;
  if (
    directionKey !== "ArrowDown" &&
    directionKey !== "ArrowUp" &&
    directionKey !== "ArrowLeft" &&
    directionKey !== "ArrowRight"
  ) {
    return false;
  }

  const target = event.target as HTMLElement;
  if (target.closest('[data-slot="select-content"]')) return false;
  if (target.closest('[role="listbox"]')) return false;
  if (!container) return false;

  const direction: CostNavDirection =
    directionKey === "ArrowDown"
      ? "down"
      : directionKey === "ArrowUp"
        ? "up"
        : directionKey === "ArrowLeft"
          ? "left"
          : "right";

  const next = findCostNavTarget(getCostNavCells(container), target, direction);
  if (!next) return false;

  event.preventDefault();
  event.stopPropagation();
  focusCostNavTarget(next);
  return true;
}

function displayDecimalText(value: number, blankWhenZero: boolean): string {
  if (blankWhenZero && value === 0) return "";
  return formatNumDisplay(value);
}

function DraftDecimalInput({
  value,
  onCommit,
  blankWhenZero = false,
  placeholder = "00.0",
  ...props
}: {
  value: number;
  onCommit: (next: number) => void;
  blankWhenZero?: boolean;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  const [text, setText] = useState(() => displayDecimalText(value, blankWhenZero));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(displayDecimalText(value, blankWhenZero));
  }, [value, blankWhenZero]);

  return (
    <Input
      {...props}
      placeholder={placeholder}
      value={text}
      onFocus={(event) => {
        focusedRef.current = true;
        props.onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        // Live-commit so outside-close keeps typed values even without blur.
        onCommit(parseDecimalInput(next));
      }}
      onBlur={(event) => {
        focusedRef.current = false;
        const parsed = parseDecimalInput(text);
        onCommit(parsed);
        setText(displayDecimalText(parsed, blankWhenZero));
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
        const merged = mergePastedNumericText(
          text,
          event.clipboardData.getData("text"),
          target.selectionStart,
          target.selectionEnd
        );
        setText(merged);
        onCommit(parseDecimalInput(merged));
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
      placeholder="1"
      value={text}
      onFocus={(event) => {
        focusedRef.current = true;
        props.onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        onCommit(parseUnitsInput(next));
      }}
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
        const merged = mergePastedNumericText(
          text,
          event.clipboardData.getData("text"),
          target.selectionStart,
          target.selectionEnd
        );
        setText(merged);
        onCommit(parseUnitsInput(merged));
        props.onPaste?.(event);
      }}
    />
  );
}

const INPUT_CLASS =
  "h-8 rounded-[10px] border-[#d7e3ff] bg-white text-xs shadow-none focus-visible:border-[#0057FF]/60 focus-visible:ring-[#0057FF]/15";

const DISCOVERY_SELECT_CONTENT_CLASS = cn(DISCOVERY_DIALOG_SELECT_CONTENT_CLASS, "z-[200]");

type Props = {
  deliverable: QuotationDeliverable;
  item: QuotationItemRow;
  draft: QuotationRowDraft | undefined;
  onApply: (next: QuotationDeliverable) => void;
  /** Live sync while the panel is open so parent/card state can update before close. */
  onLiveChange?: (next: QuotationDeliverable) => void;
  /** When set, price and trigger render on one line (price first, then Cost details). */
  priceLabel?: string;
  /** Quotation-currency equivalent under the entry-currency price. */
  priceSecondaryLabel?: string | null;
  gpPctLabel?: string | null;
  /** Open cost details on mount (e.g. after adding a manual row). */
  defaultOpen?: boolean;
  /** Stacked mock layout: price dash above + Cost detail link. */
  priceLayout?: "inline" | "stacked";
};

export function QuotationDeliverableCostDetails({
  deliverable,
  item,
  draft,
  onApply,
  onLiveChange,
  priceLabel,
  priceSecondaryLabel,
  gpPctLabel,
  defaultOpen,
  priceLayout = "inline",
}: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const didAutoOpenRef = useRef(false);
  const fieldsGridRef = useRef<HTMLDivElement>(null);
  const [localDeliverable, setLocalDeliverable] = useState(deliverable);
  const localDeliverableRef = useRef(deliverable);
  const openSnapshotRef = useRef<string | null>(null);
  const fxRate = draft?.fxRateToEgp ?? item.fx_rate_to_egp ?? 1;

  useEffect(() => {
    localDeliverableRef.current = localDeliverable;
  }, [localDeliverable]);

  // Sync from parent only while closed so reopen shows draft kept after outside-close.
  useEffect(() => {
    if (!open) {
      setLocalDeliverable(deliverable);
      localDeliverableRef.current = deliverable;
    }
  }, [deliverable, open]);

  useEffect(() => {
    if (!defaultOpen || didAutoOpenRef.current) return;
    didAutoOpenRef.current = true;
    const normalized = withDeliverableCommercialPatch(deliverable, {}, fxRate);
    setLocalDeliverable(normalized);
    localDeliverableRef.current = normalized;
    openSnapshotRef.current = deliverableSnapshot(normalized);
    setOpen(true);
  }, [defaultOpen, deliverable, fxRate]);

  const defaults = useMemo(() => {
    const base = deliverableCommercialDefaults(item);
    if (!draft) return base;
    const deliverableEmpty =
      !(Number(deliverable.cost) > 0) &&
      !(Number(deliverable.revenue) > 0) &&
      deliverable.free_for_client !== true;
    if (!deliverableEmpty) return base;
    if (draft.cost <= 0 && draft.revenue <= 0) return base;
    return {
      ...base,
      commercial_input_mode: draft.mode,
      cost_currency: draft.costCurrency || base.cost_currency,
      cost: draft.cost,
      revenue: draft.revenue,
      gp_pct: draft.gpPct,
      gp_value: draft.gpValue,
      af_pct: draft.afPct,
    };
  }, [item, draft, deliverable.cost, deliverable.revenue, deliverable.free_for_client]);

  const freeForClient = isDeliverableFreeForClient(localDeliverable);
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

  const computedTotalClientCost = useMemo(
    () => computeDeliverableTotalClientCost(localDeliverable, fxRate, defaults.af_pct),
    [localDeliverable, fxRate, defaults.af_pct]
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
    const next = withDeliverableCommercialPatch(localDeliverableRef.current, partial, fxRate);
    localDeliverableRef.current = next;
    setLocalDeliverable(next);
    if (open) {
      queueMicrotask(() => onLiveChange?.(next));
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      const seedEmpty =
        !(Number(deliverable.cost) > 0) &&
        !(Number(deliverable.revenue) > 0) &&
        deliverable.free_for_client !== true;
      const defaultCost = Number(defaults.cost) || 0;
      const defaultRevenue = Number(defaults.revenue) || 0;
      const seeded =
        seedEmpty && (defaultCost > 0 || defaultRevenue > 0)
          ? {
              ...deliverable,
              commercial_input_mode: defaults.commercial_input_mode,
              cost: defaultCost,
              revenue: defaultRevenue > 0 ? defaultRevenue : null,
              gp_pct: defaults.gp_pct,
              gp_value: defaults.gp_value,
              af_pct: defaults.af_pct,
              cost_currency: defaults.cost_currency,
            }
          : deliverable;
      const normalized = withDeliverableCommercialPatch(seeded, {}, fxRate);
      setLocalDeliverable(normalized);
      localDeliverableRef.current = normalized;
      openSnapshotRef.current = deliverableSnapshot(normalized);
      setOpen(true);
      return;
    }

    setOpen(false);
    const patched = withDeliverableCommercialPatch(localDeliverableRef.current, {}, fxRate);
    // Keep amounts in the quotation draft on outside-close; Save persists to server.
    if (
      openSnapshotRef.current == null ||
      openSnapshotRef.current !== deliverableSnapshot(patched)
    ) {
      onApply(patched);
    }
    openSnapshotRef.current = null;
  }

  function handlePanelKeyDownCapture(event: React.KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('[data-slot="select-content"]')) return;
    if (target.closest('[role="listbox"]')) return;

    if (handleCostFieldArrowNav(event, fieldsGridRef.current)) return;

    if (event.key !== "Enter" || event.shiftKey) return;
    if (target.closest('[data-slot="select-trigger"]')) return;

    event.preventDefault();
    event.stopPropagation();
    handleOpenChange(false);
  }

  function focusUnitCostInput() {
    requestAnimationFrame(() => {
      const input = fieldsGridRef.current?.querySelector<HTMLInputElement>(
        '[data-cost-focus="unit-cost"]'
      );
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  const trigger = (
    <Button
      type="button"
      variant="link"
      className="h-auto min-h-6 shrink-0 px-0 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[var(--blue-text,#0b52e0)] no-underline hover:underline"
      onClick={() => handleOpenChange(true)}
    >
      + Cost detail
    </Button>
  );

  const panel = (
    <div className="quotation-cost-detail-panel__inner quotation-cost-detail-panel__inner--landscape">
      <DialogTitle className="quotation-cost-detail-panel__title">Cost details</DialogTitle>
      <DialogDescription className="quotation-cost-detail-panel__hint">
        Values stay when you close this panel. Click Save on the quotation to persist.
      </DialogDescription>
      <div
        ref={fieldsGridRef}
        className="quotation-cost-detail-panel__grid grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-3"
      >
        <label
          data-cost-nav-field
          className="col-span-3 flex items-start gap-2.5 rounded-[10px] border border-[#d7e3ff] bg-[#f8faff] px-2.5 py-2"
        >
          <Checkbox
            checked={freeForClient}
            onCheckedChange={(checked) =>
              patchLocal({ free_for_client: checked === true })
            }
            className="mt-0.5"
            aria-label="Free for the client"
          />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-[#1e3a8a]">
              Free for the client
            </span>
            <span className="mt-0.5 block text-[10px] leading-snug text-[#64748b]">
              Sets client cost to zero. Unit cost can still be entered for internal margin.
            </span>
          </span>
        </label>
        {!freeForClient ? (
          <Field label="Calculation" navField>
            <Select
              value={mode}
              onValueChange={(v) =>
                patchLocal({ commercial_input_mode: v as CommercialInputMode })
              }
            >
              <SelectTrigger className={DISCOVERY_DIALOG_INPUT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className={DISCOVERY_SELECT_CONTENT_CLASS}
                position="popper"
                align="start"
              >
                {(Object.keys(COMMERCIAL_INPUT_MODE_LABELS) as CommercialInputMode[]).map((m) => (
                  <SelectItem key={m} value={m} className={DISCOVERY_DIALOG_SELECT_ITEM_CLASS}>
                    {COMMERCIAL_INPUT_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="Currency" navField>
          <Select value={costCurrency} onValueChange={(v) => patchLocal({ cost_currency: v })}>
            <SelectTrigger className={DISCOVERY_DIALOG_INPUT_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={DISCOVERY_SELECT_CONTENT_CLASS} position="popper" align="start">
              {COMMERCIAL_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c} className={DISCOVERY_DIALOG_SELECT_ITEM_CLASS}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Pricing units" navField>
          <DraftUnitsInput
            className={INPUT_CLASS}
            inputMode="numeric"
            min={1}
            step={1}
            value={units}
            onCommit={(next) => patchLocal({ quantity: next })}
          />
        </Field>
        <Field label="Unit cost" navField>
          <DraftDecimalInput
            data-cost-focus="unit-cost"
            className={INPUT_CLASS}
            inputMode="decimal"
            blankWhenZero
            placeholder="00.0"
            value={cost}
            onCommit={(next) => patchLocal({ cost: next })}
          />
        </Field>
        {freeForClient ? (
          <Field label={QUOTATION_CLIENT_LABELS.clientCost}>
            <p className="pt-1 text-xs font-semibold text-[#1e3a8a]">Free</p>
          </Field>
        ) : mode === "cost_revenue" ? (
          <Field label={QUOTATION_CLIENT_LABELS.clientCost} navField>
            <DraftDecimalInput
              className={INPUT_CLASS}
              inputMode="decimal"
              blankWhenZero
              placeholder="00.0"
              value={localDeliverable.revenue ?? defaults.revenue ?? 0}
              onCommit={(next) => patchLocal({ revenue: next })}
            />
          </Field>
        ) : (
          <Field label={QUOTATION_CLIENT_LABELS.clientCost}>
            <p className="pt-1 text-xs font-semibold tabular-nums text-[#1e3a8a]">
              {formatDualCurrency({
                amount: computedTotalClientCost,
                currency: costCurrency,
                egpAmount:
                  costCurrency === "EGP" ? computedTotalClientCost : computedTotalClientCost * fxRate,
              })}
            </p>
            {afPct > 0 && computedRevenue > 0 ? (
              <p className="text-[10px] text-muted-foreground">
                Includes {new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(afPct)}% agency fee
              </p>
            ) : null}
            {units > 1 ? (
              <p className="text-[10px] text-muted-foreground">
                {units} units × unit cost {new Intl.NumberFormat("en-US").format(cost)}{" "}
                {costCurrency}
              </p>
            ) : null}
          </Field>
        )}
        <Field label="AF%" navField>
          <div className="flex items-center gap-1">
            <DraftDecimalInput
              className={INPUT_CLASS}
              inputMode="decimal"
              blankWhenZero
              placeholder="00.0"
              value={afPct}
              onCommit={(next) => patchLocal({ af_pct: next })}
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
        </Field>
        {!freeForClient && mode === "cost_gp_value" ? (
          <Field label="GP" navField>
            <DraftDecimalInput
              className={INPUT_CLASS}
              inputMode="decimal"
              blankWhenZero
              placeholder="00.0"
              value={gpValue}
              onCommit={(next) => patchLocal({ gp_value: next })}
            />
          </Field>
        ) : null}
        {!freeForClient && mode === "cost_revenue" ? (
          <Field label="GP%">
            <p className="pt-1 text-xs tabular-nums text-[#1e3a8a]">
              {computedRevenue > 0 ? `${computedGp.gpPct.toFixed(1)}%` : "—"}
            </p>
          </Field>
        ) : null}
        {!freeForClient && (mode === "cost_gp_pct" || mode === "cost_markup_pct") ? (
          <Field label="GP%" navField>
            <div className="flex items-center gap-1">
              <DraftDecimalInput
                className={INPUT_CLASS}
                inputMode="decimal"
                blankWhenZero
                placeholder="00.0"
                value={gpPct}
                onCommit={(next) => patchLocal({ gp_pct: next })}
              />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          </Field>
        ) : null}
        {!freeForClient ? (
          <div className="col-span-3 rounded-[10px] border border-[#d7e3ff] bg-[#f8faff] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-[#64748b]">Client pays</span>
              <span className="text-xs font-bold tabular-nums text-[#1e3a8a]">
                {formatDualCurrency({
                  amount: computedTotalClientCost,
                  currency: costCurrency,
                  egpAmount:
                    costCurrency === "EGP"
                      ? computedTotalClientCost
                      : computedTotalClientCost * fxRate,
                })}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-[#64748b]">
              {mode === "cost_markup_pct"
                ? "Price = cost × (1 + markup%)."
                : mode === "cost_gp_pct"
                  ? "Price = cost ÷ (1 − margin%); margin must stay below 100%."
                  : mode === "cost_revenue"
                    ? "Flat price is entered directly; a price below cost produces negative GP."
                    : "Price = cost + GP value."}
              {afPct > 0 ? " Agency fee is added to the client payment." : ""}
            </p>
            {computedGp.warning ? (
              <p className="mt-1 text-[10px] font-semibold text-amber-700">
                {computedGp.warning}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-[10px] bg-[#0057FF] px-3 text-xs font-semibold text-white hover:bg-[#0046cc]"
          onClick={() => handleOpenChange(false)}
        >
          Done
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {priceLabel != null ? (
        priceLayout === "stacked" ? (
          <div className="price-cell">
            {priceLabel !== "—" ? (
              <span className="dash text-[12.5px] font-semibold tabular-nums text-[var(--text)]">
                {priceLabel}
              </span>
            ) : (
              <span className="dash text-[12.5px] text-[var(--text-4)]">—</span>
            )}
            {priceSecondaryLabel ? (
              <span className="price-fx-sub text-[10.5px] tabular-nums text-[var(--text-4,#8b93a7)]">
                {priceSecondaryLabel}
              </span>
            ) : null}
            {trigger}
            {gpPctLabel ? (
              <span className="price-gp-sub text-[11px] tabular-nums text-[var(--text-4)]">
                {gpPctLabel} GP
              </span>
            ) : null}
          </div>
        ) : (
          <div className="inline-flex max-w-none flex-col items-end gap-0.5 whitespace-nowrap py-0.5">
            <div className="inline-flex items-center justify-end gap-2.5">
              <div className="inline-flex flex-col items-end gap-0.5">
                {priceLabel !== "—" ? (
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {priceLabel}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
                {priceSecondaryLabel ? (
                  <span className="text-[10.5px] tabular-nums text-muted-foreground">
                    {priceSecondaryLabel}
                  </span>
                ) : null}
              </div>
              {trigger}
            </div>
            {gpPctLabel ? (
              <span className="price-gp-sub text-[11px] tabular-nums text-muted-foreground">
                {gpPctLabel} GP
              </span>
            ) : null}
          </div>
        )
      ) : (
        trigger
      )}
      {/* Centered dialog avoids sticky Discovery/quotation header collision that popovers hit. */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[180] bg-slate-900/25 supports-backdrop-filter:backdrop-blur-[2px]"
          className={cn(
            "quotation-cost-detail-panel z-[190] w-[min(100vw-2rem,42rem)] max-w-[42rem] translate-x-[-50%] translate-y-[-50%] gap-0 border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[42rem]"
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusUnitCostInput();
          }}
          onKeyDown={stopShortcutBubble}
          onKeyDownCapture={handlePanelKeyDownCapture}
        >
          {panel}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  children,
  navField = false,
}: {
  label: string;
  children: React.ReactNode;
  navField?: boolean;
}) {
  return (
    <div className="space-y-1" {...(navField ? { "data-cost-nav-field": true } : {})}>
      <Label className="text-[10px] font-semibold tracking-wide text-[#64748b] uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
