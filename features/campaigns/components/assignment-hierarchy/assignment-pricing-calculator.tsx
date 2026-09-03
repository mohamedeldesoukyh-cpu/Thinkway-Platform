"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { useConfirmAction } from "@/components/shared/confirm-action-provider";
import { updateAssignmentLineCommercialsAction } from "@/features/campaigns/actions/update-assignment-line-commercials";
import {
  CommercialRevisionDialog,
  type CommercialRevisionDialogLine,
} from "@/features/campaigns/components/commercial-revision-dialog";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import {
  PRICING_CALCULATOR_MODES,
  previewPricingCalculatorLines,
  type PricingCalculatorMode,
} from "@/lib/campaigns/assignment-pricing-calculator";
import { cn } from "@/lib/utils";

export type AssignmentCalculatorLine = {
  lineId: string;
  name: string;
  cost: number;
  revenue: number;
  vatPercent: number;
  usage_rights_amount: number;
  usage_rights_cost: number;
  agency_fee_percent: number;
  locked?: boolean;
};

type AssignmentPricingCalculatorProps = {
  campaignId: string;
  currency: string;
  currencyMixed: boolean;
  lines: AssignmentCalculatorLine[];
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
};

export function AssignmentPricingCalculator({
  campaignId,
  currency,
  currencyMixed,
  lines,
  open,
  onClose,
  onApplied,
}: AssignmentPricingCalculatorProps) {
  const { confirm } = useConfirmAction();
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<PricingCalculatorMode>("af");
  const [value, setValue] = useState(PRICING_CALCULATOR_MODES.af.defaultValue);
  const [vatPercent, setVatPercent] = useState(14);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionQuotationId, setRevisionQuotationId] = useState<string | null>(
    null
  );
  const [revisionLines, setRevisionLines] = useState<
    CommercialRevisionDialogLine[]
  >([]);

  const unlocked = useMemo(
    () => lines.filter((line) => !line.locked),
    [lines]
  );

  const preview = useMemo(
    () =>
      previewPricingCalculatorLines(unlocked, mode, value, vatPercent),
    [unlocked, mode, value, vatPercent]
  );

  const totals = useMemo(() => {
    return preview.reduce(
      (acc, row) => ({
        cost: acc.cost + row.cost,
        oldRevenue: acc.oldRevenue + row.revenue,
        revenue: acc.revenue + row.newRevenue,
        gp: acc.gp + row.gp,
        vat: acc.vat + row.vat,
      }),
      { cost: 0, oldRevenue: 0, revenue: 0, gp: 0, vat: 0 }
    );
  }, [preview]);

  const belowCostCount = preview.filter((row) => row.belowCost).length;
  const marginUnsolvable = mode === "gpm" && value >= 100;
  const meta = PRICING_CALCULATOR_MODES[mode];
  const marginPercent = totals.revenue
    ? (totals.gp / totals.revenue) * 100
    : 0;
  const delta = totals.revenue - totals.oldRevenue;

  if (!open || lines.length === 0 || typeof document === "undefined") {
    return null;
  }

  function selectMode(next: PricingCalculatorMode) {
    setMode(next);
    setValue(PRICING_CALCULATOR_MODES[next].defaultValue);
  }

  function handleApply() {
    if (currencyMixed) {
      toast.error("Cannot apply calculator across mixed currencies.");
      return;
    }
    if (unlocked.length === 0) {
      toast.error("No unlocked lines in this selection.");
      return;
    }
    startTransition(async () => {
      const byId = new Map(unlocked.map((line) => [line.lineId, line]));
      const result = await updateAssignmentLineCommercialsAction({
        campaignId,
        lines: preview.map((row) => {
          const src = byId.get(row.lineId)!;
          return {
            lineId: row.lineId,
            revenue_before_vat: row.newRevenue,
            cost_before_vat: src.cost,
            usage_rights_amount: src.usage_rights_amount,
            usage_rights_cost: src.usage_rights_cost,
            agency_fee_percent: src.agency_fee_percent,
          };
        }),
      });
      if (!result.ok) {
        if (
          result.code === "FINANCE_LOCKED" &&
          result.revisionLines &&
          result.revisionLines.length > 0 &&
          result.quotationId
        ) {
          const accepted = await confirm({
            title: result.confirmationTitle ?? "Commercial Revision required",
            description: result.confirmationDescription ?? result.message,
            confirmLabel: result.confirmLabel ?? "Create Commercial Revision",
          });
          if (!accepted) return;
          setRevisionQuotationId(result.quotationId);
          setRevisionLines(result.revisionLines);
          setRevisionOpen(true);
          return;
        }
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      refreshAfterOperationalMutation();
      onApplied?.();
      onClose();
    });
  }

  return createPortal(
    <div className="campaign-detail-suite">
      <div className="tw-calcp" role="dialog" aria-label="Pricing calculator">
        <div className="tw-calcp__h">
          <b>Pricing calculator</b>
          <span>
            {unlocked.length} creator{unlocked.length === 1 ? "" : "s"} selected
            {currencyMixed ? " · mixed CCY" : ` · ${currency}`}
          </span>
          <span className="tw-sp" />
          <span className="tw-calcp__formula">{meta.formula}</span>
          <button
            type="button"
            className="tw-dr__x"
            onClick={onClose}
            aria-label="Close calculator"
          >
            ×
          </button>
        </div>
        <div className="tw-calcp__c">
          <div className="tw-modes">
            {(Object.keys(PRICING_CALCULATOR_MODES) as PricingCalculatorMode[]).map(
              (key) => {
                const item = PRICING_CALCULATOR_MODES[key];
                return (
                  <button
                    key={key}
                    type="button"
                    className="tw-mode"
                    aria-pressed={mode === key}
                    onClick={() => selectMode(key)}
                  >
                    <b>{item.label}</b>
                    <u>{item.formula}</u>
                  </button>
                );
              }
            )}
          </div>
          <div className="tw-cin">
            <div className="tw-f">
              <label htmlFor="tw-calc-value">
                {meta.label.replace("Cost + ", "")}
              </label>
              <input
                id="tw-calc-value"
                className="tw-in"
                inputMode="decimal"
                aria-label="Calculator value"
                value={value}
                onChange={(e) =>
                  setValue(Math.max(0, Number(e.target.value.replace(/[^\d.]/g, "")) || 0))
                }
              />
            </div>
            <div className="tw-f tw-f-vat">
              <label htmlFor="tw-calc-vat">VAT %</label>
              <input
                id="tw-calc-vat"
                className="tw-in"
                inputMode="decimal"
                aria-label="VAT percent"
                value={vatPercent}
                onChange={(e) =>
                  setVatPercent(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </div>
            {mode === "af" || mode === "gpm" ? (
              <span className="tw-calc-chips">
                {[10, 20, 25, 30, 35, 50].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="tw-chip"
                    onClick={() => setValue(chip)}
                  >
                    {chip}%
                  </button>
                ))}
              </span>
            ) : null}
            <span className="tw-sp" />
            <span className="tw-cs">
              Applies to the {unlocked.length} selected unlocked line
              {unlocked.length === 1 ? "" : "s"} only
            </span>
          </div>
        </div>
        <div className="tw-calcp__b">
          <div
            className="tw-g tw-hr"
            style={{
              ["--cols" as string]:
                "minmax(150px,1.2fr) 108px 112px 112px 100px 78px 112px 96px",
            }}
          >
            <span>Creator</span>
            <span className="tw-rr">Cost</span>
            <span className="tw-rr">Revenue now</span>
            <span className="tw-rr">New revenue</span>
            <span className="tw-rr">GP</span>
            <span className="tw-rr">Margin</span>
            <span className="tw-rr">VAT {vatPercent}%</span>
            <span className="tw-rr">Change</span>
          </div>
          {preview.map((row) => {
            const src = unlocked.find((line) => line.lineId === row.lineId);
            const up = row.delta >= 0;
            return (
              <div
                key={row.lineId}
                className="tw-g tw-r"
                style={{
                  ["--cols" as string]:
                    "minmax(150px,1.2fr) 108px 112px 112px 100px 78px 112px 96px",
                }}
              >
                <span>{src?.name ?? row.lineId}</span>
                <span className="tw-v">{formatOperationalAmount(row.cost)}</span>
                <span className={cn("tw-v", row.revenue === 0 && "z")}>
                  {formatOperationalAmount(row.revenue)}
                </span>
                <span className="tw-v">
                  <b>{formatOperationalAmount(row.newRevenue)}</b>
                </span>
                <span className="tw-v pos">{formatOperationalAmount(row.gp)}</span>
                <span className="tw-v">{row.marginPercent.toFixed(1)}%</span>
                <span className="tw-v neg">{formatOperationalAmount(row.vat)}</span>
                <span className="tw-rr">
                  <span className={cn("tw-delta", up ? "up" : "dn")}>
                    {up ? "+" : ""}
                    {formatOperationalAmount(row.delta)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        {belowCostCount ? (
          <div className="tw-warnrow">
            {belowCostCount} line{belowCostCount === 1 ? "" : "s"} would price
            below cost — GP goes negative. Check the value before applying.
          </div>
        ) : null}
        {marginUnsolvable ? (
          <div className="tw-warnrow">
            A margin of 100% or more cannot be solved — revenue is left at cost.
          </div>
        ) : null}
        {mode === "pr" ? (
          <div className="tw-warnrow">
            Client price sets the same revenue on every selected line, ignoring
            their individual costs.
          </div>
        ) : null}
        <div className="tw-calcp__f">
          <div>
            <i>Cost</i>
            <b>{formatOperationalAmount(totals.cost)}</b>
          </div>
          <div>
            <i>New revenue</i>
            <b>{formatOperationalAmount(totals.revenue)}</b>
          </div>
          <div>
            <i>Gross profit</i>
            <b className="g">{formatOperationalAmount(totals.gp)}</b>
          </div>
          <div>
            <i>Margin</i>
            <b className="g">{marginPercent.toFixed(1)}%</b>
          </div>
          <div>
            <i>VAT {vatPercent}%</i>
            <b>{formatOperationalAmount(totals.vat)}</b>
          </div>
          <div>
            <i>Total billing</i>
            <b>{formatOperationalAmount(totals.revenue + totals.vat)}</b>
          </div>
          <div>
            <i>Change</i>
            <b className={delta >= 0 ? "g" : "r"}>
              {delta >= 0 ? "+" : ""}
              {formatOperationalAmount(delta)}
            </b>
          </div>
        </div>
        <div className="tw-calcp__a">
          <span className="tw-cs">
            Nothing is written until you apply. VAT is excluded from GP and from
            PO utilisation.
          </span>
          <span className="tw-sp" />
          <button type="button" className="tw-b sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="tw-b sm pri"
            disabled={pending || currencyMixed || unlocked.length === 0}
            onClick={handleApply}
          >
            {pending
              ? "Applying…"
              : `Apply to ${unlocked.length} line${unlocked.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
      {revisionQuotationId ? (
        <CommercialRevisionDialog
          open={revisionOpen}
          onOpenChange={setRevisionOpen}
          campaignHeaderId={campaignId}
          quotationId={revisionQuotationId}
          lines={revisionLines}
          onSubmitted={() => {
            refreshAfterOperationalMutation();
            onApplied?.();
            onClose();
          }}
        />
      ) : null}
    </div>,
    document.body
  );
}
