"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  confirmCreatorsAction,
  decideReviewAction,
  removeUnpricedSelectedAction,
} from "../actions/client-workspace-actions";
import type { ClientCreatorSelectionState } from "../constants";
import { formatCompactCount, formatEngagementPct, TO_BE_CONFIRMED } from "../format";
import { projectSelectionSummaryFromCards } from "../media-plan-summary";
import { clientWorkspacePathReviewId } from "../journey-state";
import { buildClientReviewPath } from "../security/review-token";
import {
  APPROVE_SELECTED_CREATORS_LABEL,
  CONFIRM_CREATORS_SUPPORTING_TEXT,
  UNPRICED_SELECTED_CODE,
  canEnableApproveSelectedCreators,
  primaryActionForJourney,
  selectionCalculator,
} from "../selection-flow";
import type { ClientWorkspaceView } from "../types";
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
  onSelectAll,
  onClear,
}: {
  view: ClientWorkspaceView;
  token: string;
  selection?: Record<string, ClientCreatorSelectionState>;
  variant?: "card" | "bar";
  showBulkControls?: boolean;
  showActions?: boolean;
  onSelectAll?: () => void;
  onClear?: () => void;
}) {
  const router = useRouter();
  const { goToSection } = useClientWorkspaceState();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [unpricedBlock, setUnpricedBlock] = useState(false);
  const resolvedSelection =
    selection ??
    Object.fromEntries(view.creators.map((creator) => [creator.creatorId, creator.selection]));
  const calc = selectionCalculator(view.creators, resolvedSelection);
  const currency = view.commercial.currency;
  const investment = calc.pricedInvestment;
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
  const canApproveSelected = canEnableApproveSelectedCreators({
    historical: Boolean(view.journey?.historical),
    interactive: view.canDecide,
    selectedCount: calc.selectedCount,
    unpricedSelectedCount: calc.unpricedSelectedCount,
    selectionConfirmed: confirmed,
  });
  const showApproveSelected = showBulkControls && !confirmed;
  const canAct =
    variant === "bar"
      ? view.canDecide && !pending && canApproveSelected
      : view.canDecide &&
        !pending &&
        (primary.kind === "approve"
          ? calc.selectedCount > 0 && calc.unpricedSelectedCount === 0
          : canApproveSelected);
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

  function openSection(event: React.MouseEvent<HTMLAnchorElement>, next: "creators") {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    goToSection(next);
  }

  function runPrimary() {
    startTransition(async () => {
      setUnpricedBlock(false);
      if (variant === "bar" || primary.kind === "confirm") {
        if (calc.unpricedSelectedCount > 0) {
          setUnpricedBlock(true);
          setError(calc.unpricedMessage);
          return;
        }
        const result = await confirmCreatorsAction({ token });
        if (!result.ok) {
          setError(result.message);
          if (result.code === UNPRICED_SELECTED_CODE) setUnpricedBlock(true);
          return;
        }
        goToSection("commercial");
        router.refresh();
        return;
      }
      const result = await decideReviewAction({
        token,
        decision: "approved",
        stage: "quotation",
      });
      if (!result.ok) {
        setError(result.message);
        if (result.code === UNPRICED_SELECTED_CODE) setUnpricedBlock(true);
        return;
      }
      router.refresh();
    });
  }

  function removeUnpriced() {
    startTransition(async () => {
      const result = await removeUnpricedSelectedAction({ token });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setUnpricedBlock(false);
      setError(null);
      router.refresh();
    });
  }

  if (variant === "bar") {
    return (
      <div className="summary sumbar">
        <Metric label="Selected" value={`${calc.selectedCount} / ${view.creators.length}`} />
        <Metric label="Priced" value={String(calc.pricedSelectedCount)} />
        <Metric
          label="Pricing required"
          value={String(calc.unpricedSelectedCount)}
          missing={calc.unpricedSelectedCount > 0}
        />
        <Metric
          label="Selected investment"
          value={investment > 0 ? formatMoneyKpi(investment, currency) : TO_BE_CONFIRMED}
          missing={investment <= 0}
        />
        <Metric
          label="Est. reach"
          value={formatCompactCount(forecast.estimatedReach)}
          missing={forecast.estimatedReach == null}
        />
        <Metric
          label="Engagements"
          value={formatCompactCount(forecast.estimatedEngagements)}
          missing={forecast.estimatedEngagements == null}
        />
        <div className="sp" />
        {showBulkControls ? (
          <div className="sumbar-cta">
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
            {confirmed ? (
              <span className="sc ok">Client Approved</span>
            ) : (
              <button type="button" className="btn pri" disabled={!canAct} onClick={runPrimary}>
                <IconCheck />
                {APPROVE_SELECTED_CREATORS_LABEL}
              </button>
            )}
          </div>
        ) : null}
        {error ? <p className="sumbar-msg">{error}</p> : emptyHint ? <p className="sumbar-msg">{emptyHint}</p> : null}
        {unpricedBlock ? (
          <div className="sumbar-cta">
            <button type="button" className="btn pri" disabled={pending} onClick={removeUnpriced}>
              Remove unpriced creators
            </button>
            <span className="sumbar-msg">or wait for pricing</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card sumcard">
      <p className="st">Proposal summary</p>
      <p className="ss">
        {view.overview.campaignName} · v{view.review.reviewNumber}
        {primary.kind === "confirm" ? ` · ${CONFIRM_CREATORS_SUPPORTING_TEXT}` : ""}
      </p>
      <Row
        label="Selected investment"
        value={investment > 0 ? formatMoneyKpi(investment, currency) : TO_BE_CONFIRMED}
        missing={investment <= 0}
        big
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
      {unpricedBlock ? (
        <div className="cta sumcta">
          <button type="button" className="btn pri" disabled={pending} onClick={removeUnpriced}>
            Remove unpriced creators
          </button>
          <button type="button" className="btn sec" disabled>
            Wait for pricing
          </button>
        </div>
      ) : showActions && view.canDecide && actionLabel ? (
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
