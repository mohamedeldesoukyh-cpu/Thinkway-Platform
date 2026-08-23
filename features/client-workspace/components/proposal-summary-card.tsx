"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  confirmCreatorsAction,
  decideReviewAction,
} from "../actions/client-workspace-actions";
import type { ClientCreatorSelectionState } from "../constants";
import { formatCompactCount, formatEngagementPct, TO_BE_CONFIRMED } from "../format";
import { projectSelectionSummaryFromCards } from "../media-plan-summary";
import { clientWorkspacePathReviewId } from "../journey-state";
import { buildClientReviewPath } from "../security/review-token";
import {
  AFTER_CREATOR_APPROVAL_SECTION,
  APPROVE_SELECTED_CREATORS_LABEL,
  CONFIRM_CREATORS_SUPPORTING_TEXT,
  CONTINUE_TO_YOUR_SELECTION_LABEL,
  UNPRICED_INCLUDED_MESSAGE,
  buildCreatorApprovalConfirmation,
  canEnableApproveSelectedCreators,
  hydrateClientSelection,
  primaryActionForJourney,
  selectionCalculator,
  shortlistContinueToYourSelection,
} from "../selection-flow";
import type { ClientWorkspaceView } from "../types";
import { clientShowsCostAndFees } from "../quotation-client-facing";
import { useClientWorkspaceState } from "./client-workspace-state";
import { IconCheck } from "./review-icons";

function money(value: number | undefined, currency: string): string {
  return value != null ? formatMoneyKpi(value, currency) : TO_BE_CONFIRMED;
}

function Row({
  label,
  value,
  hint,
  big,
  missing,
}: {
  label: string;
  value: string;
  hint?: string;
  big?: boolean;
  missing?: boolean;
}) {
  return (
    <div className={big ? "sumrow big" : "sumrow"}>
      <span className="k">
        {label}
        {hint ? <span className="hint">{hint}</span> : null}
      </span>
      <span className={missing ? "v tbc" : "v"}>{value}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  missing,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="sumbar-m">
      <span className="l">{label}</span>
      <span className={missing ? "v tbc" : "v"}>{value}</span>
    </div>
  );
}

export function ProposalSummaryCard({
  view,
  token,
  selection,
  variant = "card",
  showBulkControls = false,
  showActions = true,
  barAction = "none",
  onSelectAll,
  onClear,
}: {
  view: ClientWorkspaceView;
  token: string;
  selection?: Record<string, ClientCreatorSelectionState>;
  variant?: "card" | "bar";
  showBulkControls?: boolean;
  showActions?: boolean;
  barAction?: "continue" | "approve" | "none";
  onSelectAll?: () => void;
  onClear?: () => void;
}) {
  const router = useRouter();
  const { goToSection } = useClientWorkspaceState();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingIds = view.journey?.pendingCommercialApprovalCreatorIds ?? [];
  const lockedIds = (view.journey?.clientApprovedCreatorIds ?? []).filter(
    (id) => !pendingIds.includes(id)
  );
  const resolvedSelection = hydrateClientSelection(
    view.creators,
    selection ??
      Object.fromEntries(view.creators.map((creator) => [creator.creatorId, creator.selection])),
    lockedIds
  );
  const calc = selectionCalculator(view.creators, resolvedSelection);
  const currency = view.commercial.currency;
  const showCostAndFees = clientShowsCostAndFees(Boolean(view.hideCostAndFees));
  const clientCost = calc.pricedInvestment;
  const agencyFees = calc.agencyFees;
  const totalInvestment = calc.totalInvestment;
  const hasPricedTotals = calc.pricedSelectedCount > 0;
  const confirmation = buildCreatorApprovalConfirmation(view.creators, resolvedSelection);
  const forecast = projectSelectionSummaryFromCards(view.creators, resolvedSelection, currency);
  const er =
    forecast.averageEngagementRate != null
      ? formatEngagementPct(forecast.averageEngagementRate)
      : TO_BE_CONFIRMED;
  const pathReviewId = clientWorkspacePathReviewId({
    historical: Boolean(view.journey?.historical),
    viewedReviewId: view.review.id,
    canonicalReviewId: view.journey?.canonicalReviewId,
  });
  const creatorsHref = buildClientReviewPath(pathReviewId, token, "creators");
  const confirmed = Boolean(view.journey?.selectionConfirmed);
  const primary = primaryActionForJourney({
    canConfirmCreators: Boolean(view.journey?.canConfirmCreators),
    canApproveFinalQuotation: Boolean(view.journey?.canApproveFinalQuotation),
  });
  const pendingSelectedCount = pendingIds.filter((id) => resolvedSelection[id] === "accepted").length;
  const canApproveSelected = canEnableApproveSelectedCreators({
    historical: Boolean(view.journey?.historical),
    interactive: view.canDecide,
    selectedCount: calc.selectedCount,
    unpricedSelectedCount: calc.unpricedSelectedCount,
    selectionConfirmed: confirmed,
    pendingSelectedCount,
  });
  const showApproveSelected = barAction === "approve" && (!confirmed || pendingIds.length > 0);
  const showContinueToSelection = barAction === "continue" && !confirmed;
  const canContinueToSelection =
    showContinueToSelection && view.canDecide && !pending && calc.selectedCount > 0;
  const canAct =
    variant === "bar"
      ? view.canDecide && !pending && canApproveSelected
      : view.canDecide &&
        !pending &&
        (primary.kind === "approve" ? calc.pricedSelectedCount > 0 : canApproveSelected);
  const actionLabel =
    variant === "bar"
      ? showApproveSelected
        ? APPROVE_SELECTED_CREATORS_LABEL
        : null
      : primary.label || null;
  const emptyHint =
    calc.selectedCount === 0 && view.canDecide && !confirmed
      ? "Select creators to build your campaign quotation."
      : calc.unpricedMessage;

  function openSection(
    event: React.MouseEvent<HTMLAnchorElement>,
    next: "creators" | "commercial"
  ) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    goToSection(next);
  }

  function runConfirmCreators() {
    startTransition(async () => {
      const result = await confirmCreatorsAction({ token });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setConfirmOpen(false);
      goToSection(AFTER_CREATOR_APPROVAL_SECTION);
      router.refresh();
    });
  }

  function runPrimary() {
    if (variant === "bar" || primary.kind === "confirm") {
      setError(null);
      setConfirmOpen(true);
      return;
    }
    startTransition(async () => {
      const result = await decideReviewAction({
        token,
        decision: "approved",
        stage: "quotation",
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (variant === "bar") {
    return (
      <>
      <div className="summary sumbar">
        <Metric label="Selected" value={`${calc.selectedCount} / ${view.creators.length}`} />
        <Metric label="Priced" value={String(calc.pricedSelectedCount)} />
        <Metric
          label="Pricing required"
          value={String(calc.unpricedSelectedCount)}
          missing={calc.unpricedSelectedCount > 0}
        />
        {showCostAndFees ? (
          <>
        <Metric
          label="Cost"
          value={hasPricedTotals ? formatMoneyKpi(clientCost, currency) : TO_BE_CONFIRMED}
          missing={!hasPricedTotals}
        />
        <Metric
          label="Agency Fees"
          value={hasPricedTotals ? formatMoneyKpi(agencyFees, currency) : TO_BE_CONFIRMED}
          missing={!hasPricedTotals}
        />
          </>
        ) : null}
        <Metric
          label="Total Investment"
          value={hasPricedTotals ? formatMoneyKpi(totalInvestment, currency) : TO_BE_CONFIRMED}
          missing={!hasPricedTotals}
        />
        <div className="sp" />
        {showBulkControls || showContinueToSelection || showApproveSelected || confirmed ? (
          <div className="sumbar-cta">
            {showBulkControls ? (
              <>
                <button
                  type="button"
                  className="btn sec"
                  disabled={pending || confirmed || !view.canDecide}
                  onClick={onSelectAll}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn sec"
                  disabled={pending || confirmed || !view.canDecide}
                  onClick={onClear}
                >
                  Clear
                </button>
              </>
            ) : null}
            {confirmed ? (
              <span className="sc ok">Client Approved</span>
            ) : showContinueToSelection ? (
              <button
                type="button"
                className="btn pri"
                disabled={!canContinueToSelection}
                onClick={() => goToSection(shortlistContinueToYourSelection().section)}
              >
                {CONTINUE_TO_YOUR_SELECTION_LABEL}
              </button>
            ) : showApproveSelected ? (
              <button type="button" className="btn pri" disabled={!canAct} onClick={runPrimary}>
                <IconCheck />
                {APPROVE_SELECTED_CREATORS_LABEL}
              </button>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="sumbar-msg">{error}</p> : emptyHint ? <p className="sumbar-msg">{emptyHint}</p> : null}
      </div>
      {confirmOpen ? (
        <div className="confirm-mask" role="dialog" aria-modal="true" aria-labelledby="approve-creators-title">
          <div className="card confirm-panel">
            <p className="ck">Confirm selection</p>
            <h2 id="approve-creators-title">{APPROVE_SELECTED_CREATORS_LABEL}</h2>
            <p className="note">{CONFIRM_CREATORS_SUPPORTING_TEXT}</p>
            {confirmation.priced.length > 0 ? (
              <>
                <p className="subh">Priced creators</p>
                {confirmation.priced.map((row) => (
                  <div className="sumrow" key={row.creatorId}>
                    <span className="k">
                      {row.displayName}
                      <span className="hint">{row.deliverables}</span>
                    </span>
                    <span className="v">{formatMoneyKpi(row.price ?? 0, currency)}</span>
                  </div>
                ))}
              </>
            ) : null}
            {confirmation.unpriced.length > 0 ? (
              <>
                <p className="subh">Pricing required</p>
                {confirmation.unpriced.map((row) => (
                  <div className="sumrow" key={row.creatorId}>
                    <span className="k">
                      {row.displayName}
                      <span className="hint">{row.deliverables}</span>
                    </span>
                    <span className="v tbc">{TO_BE_CONFIRMED}</span>
                  </div>
                ))}
              </>
            ) : null}
            <div className="sumrow">
              <span className="k">Selected creators</span>
              <span className="v">{confirmation.selectedCount}</span>
            </div>
            <div className="sumrow">
              <span className="k">Priced creators</span>
              <span className="v">{confirmation.pricedCount}</span>
            </div>
            <div className="sumrow">
              <span className="k">Pricing required</span>
              <span className={confirmation.unpricedCount > 0 ? "v tbc" : "v"}>{confirmation.unpricedCount}</span>
            </div>
            {showCostAndFees ? (
              <>
            <div className="sumrow">
              <span className="k">Cost</span>
              <span className={hasPricedTotals ? "v" : "v tbc"}>
                {hasPricedTotals ? formatMoneyKpi(confirmation.clientCost, currency) : TO_BE_CONFIRMED}
              </span>
            </div>
            <div className="sumrow">
              <span className="k">Agency Fees</span>
              <span className={hasPricedTotals ? "v" : "v tbc"}>
                {hasPricedTotals ? formatMoneyKpi(confirmation.agencyFees, currency) : TO_BE_CONFIRMED}
              </span>
            </div>
              </>
            ) : null}
            <div className="sumrow big">
              <span className="k">Total Investment</span>
              <span className={hasPricedTotals ? "v" : "v tbc"}>
                {hasPricedTotals ? formatMoneyKpi(confirmation.totalInvestment, currency) : TO_BE_CONFIRMED}
              </span>
            </div>
            <p className="note">{UNPRICED_INCLUDED_MESSAGE}</p>
            <div className="dacts" style={{ justifyContent: "flex-start", marginTop: 16 }}>
              <button type="button" className="btn sec" disabled={pending} onClick={() => setConfirmOpen(false)}>
                Back / Review Selection
              </button>
              <button type="button" className="btn pri" disabled={pending} onClick={runConfirmCreators}>
                <IconCheck />
                {APPROVE_SELECTED_CREATORS_LABEL}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>
    );
  }

  return (
    <div className="card sumcard">
      <p className="st">Proposal summary</p>
      <p className="ss">
        {view.overview.campaignName} · v{view.review.reviewNumber}
        {primary.kind === "confirm" ? ` · ${CONFIRM_CREATORS_SUPPORTING_TEXT}` : ""}
      </p>
      {showCostAndFees ? (
        <>
      <Row
        label="Cost"
        value={hasPricedTotals ? formatMoneyKpi(clientCost, currency) : TO_BE_CONFIRMED}
        missing={!hasPricedTotals}
        big
      />
      <Row
        label="Agency Fees"
        value={hasPricedTotals ? formatMoneyKpi(agencyFees, currency) : TO_BE_CONFIRMED}
        missing={!hasPricedTotals}
      />
        </>
      ) : null}
      <Row
        label="Total Investment"
        value={hasPricedTotals ? formatMoneyKpi(totalInvestment, currency) : TO_BE_CONFIRMED}
        missing={!hasPricedTotals}
      />
      <Row label="Creators selected" hint="based on selection" value={String(calc.selectedCount)} />
      <Row label="Priced" value={String(calc.pricedSelectedCount)} />
      <Row
        label="Pricing required"
        value={String(calc.unpricedSelectedCount)}
        missing={calc.unpricedSelectedCount > 0}
      />
      <Row
        label="Est. reach"
        hint="based on selection"
        value={formatCompactCount(forecast.estimatedReach)}
        missing={forecast.estimatedReach == null}
      />
      <Row
        label="Engagements"
        hint="based on selection"
        value={formatCompactCount(forecast.estimatedEngagements)}
        missing={forecast.estimatedEngagements == null}
      />
      <Row
        label="Engagement rate"
        hint="based on selection"
        value={er}
        missing={forecast.averageEngagementRate == null}
      />
      <Row
        label="CPE"
        hint="based on selection"
        value={money(forecast.cpe, currency)}
        missing={forecast.cpe == null}
      />
      <Row
        label="CPM"
        hint="based on selection"
        value={money(forecast.cpm, currency)}
        missing={forecast.cpm == null}
      />
      {error ? (
        <p className="ss" style={{ color: "var(--bad)", marginTop: 8 }}>
          {error}
        </p>
      ) : emptyHint ? (
        <p className="ss" style={{ marginTop: 8 }}>
          {emptyHint}
        </p>
      ) : null}
      {showActions && view.canDecide && actionLabel ? (
        <div className="cta sumcta">
          <button type="button" className="btn pri" disabled={!canAct} onClick={runPrimary}>
            <IconCheck />
            {actionLabel}
          </button>
          <a className="btn sec" href={creatorsHref} onClick={(event) => openSection(event, "creators")}>
            Edit selection
          </a>
        </div>
      ) : null}
    </div>
  );
}
