"use client";

import { useMemo } from "react";

import { SectionSkeleton } from "./shared/section-skeleton";
import { formatCurrency } from "./shared/format-utils";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { BudgetHero, RationaleBar } from "./shared/studio-ui-primitives";
import { resolveBudgetData } from "../../services/section-data-resolver";
import { budgetAllocationBasisLine } from "../../services/budget-allocation";
import { deriveEnterprisePlanningNarrative } from "../../services/planning-narrative";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type BudgetPlannerSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

const COMMERCIAL_LINE_ORDER = [
  ["creator", "Creator fees", /creator|talent|influencer/i],
  ["agency", "Agency fee", /agency|management/i],
  ["production", "Production", /production/i],
  ["amplification", "Paid amplification", /amplif|media spend|paid media/i],
  ["vat", "VAT", /\bvat\b|tax/i],
  ["contingency", "Contingency", /contingen|reserve/i],
] as const;

export function BudgetPlannerSection({
  campaignObject,
  fallbackText,
  status,
}: BudgetPlannerSectionProps) {
  const isRunning = status === "running";
  const budget = resolveBudgetData(campaignObject);
  const narrative = useMemo(
    () => (campaignObject ? deriveEnterprisePlanningNarrative(campaignObject) : null),
    [campaignObject]
  );

  if (isRunning && !budget) {
    return <SectionSkeleton variant="chart" />;
  }

  if (!budget || budget.allocations.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Budget allocation pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  const total =
    budget.total ??
    budget.allocations.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  const allocationsByLine = COMMERCIAL_LINE_ORDER.map(([kind, label, pattern]) => {
    const line = budget.allocations.find((candidate) => pattern.test(candidate.category));
    return { kind, label, line };
  });
  const unclassifiedAllocations = budget.allocations.filter(
    (line) => !COMMERCIAL_LINE_ORDER.some(([, , pattern]) => pattern.test(line.category))
  );
  const allocatedAmount = budget.allocations.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  const unallocatedAmount = total > allocatedAmount ? total - allocatedAmount : null;

  return (
    <div className="min-w-0 w-full space-y-2.5">
      {narrative ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-[12px] text-foreground">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            Commercial strategy
          </p>
          <p className="mt-1">
            <b>What we should do:</b> {narrative.commercialStrategy}
          </p>
          <p className="mt-1 text-muted-foreground">
            <b className="text-foreground">Allocation logic:</b>{" "}
            {narrative.budgetNarrative.allocationLogic}
          </p>
          <p className="mt-1 text-muted-foreground">
            <b className="text-foreground">Commercial impact:</b>{" "}
            {narrative.budgetNarrative.commercialImpact}
          </p>
          <p className="mt-1 text-muted-foreground">
            <b className="text-foreground">Trade-offs:</b>{" "}
            {narrative.budgetNarrative.tradeOffs}
          </p>
        </div>
      ) : null}

      {total > 0 ? (
        <BudgetHero
          amount={formatCurrency(total, budget.currency)}
          caption="Total campaign budget"
        />
      ) : null}

      <div className="cs-planning-band" aria-label="Commercial summary">
        <div>
          <i>Budget</i>
          <b>{total > 0 ? formatCurrency(total, budget.currency) : "Not modelled"}</b>
          <u>Campaign allocation</u>
        </div>
        <div>
          <i>Modelled lines</i>
          <b>{budget.allocations.length}</b>
          <u>Canonical commercial allocations</u>
        </div>
        {unallocatedAmount != null ? (
          <div>
            <i>Unallocated</i>
            <b className="risk">{formatCurrency(unallocatedAmount, budget.currency)}</b>
            <u>Not assigned by the current allocation</u>
          </div>
        ) : null}
      </div>

      <div className="cs-commercial-list" aria-label="Commercial allocation lines">
        {allocationsByLine.map(({ kind, label, line }) => (
          <div
            key={kind}
            className={`cs-commercial-row ${kind === "creator" && line ? "creator" : ""} ${
              line ? "" : "unavailable"
            }`}
          >
            <span>{line?.category ?? label}</span>
            <span>
              {line?.amount != null
                ? `${line.percent ?? Math.round((line.amount / total) * 100)}% · ${formatCurrency(line.amount, budget.currency)}`
                : "Not modelled"}
            </span>
          </div>
        ))}
        {unclassifiedAllocations.map((line) => (
          <div key={line.category} className="cs-commercial-row">
            <span>{line.category}</span>
            <span>
              {line.amount != null
                ? `${line.percent ?? Math.round((line.amount / total) * 100)}% · ${formatCurrency(line.amount, budget.currency)}`
                : "Not modelled"}
            </span>
          </div>
        ))}
        {unallocatedAmount != null ? (
          <div className="cs-commercial-row unallocated">
            <span>Unallocated / unexplained</span>
            <span>{formatCurrency(unallocatedAmount, budget.currency)}</span>
          </div>
        ) : null}
      </div>

      {/*
        What these numbers are. "Creator fees 100% · EGP 3,000,000" under
        "Campaign budget EGP 3,000,000" read as the whole budget already
        committed as negotiated creator pricing.
      */}
      {budget.allocations.length > 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {budgetAllocationBasisLine({
            hasCommercialPricing: false,
            splitFromBrief: budget.allocations.length > 1,
          })}
        </p>
      ) : null}

      {allocationsByLine.some(({ line }) => !line) ? (
        <div className="cs-planning-callout">
          <strong>Commercial coverage</strong>
          <span>
            Lines without a canonical allocation remain not modelled. Studio does not assume zero
            cost or invent a fee split.
          </span>
        </div>
      ) : null}

      {budget.budgetPlannerReasoning ? (
        <RationaleBar>
          <b>Commercial rationale:</b> {budget.budgetPlannerReasoning}
        </RationaleBar>
      ) : null}
    </div>
  );
}
