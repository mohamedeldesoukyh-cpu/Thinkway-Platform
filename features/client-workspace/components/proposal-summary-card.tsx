"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { decideReviewAction } from "../actions/client-workspace-actions";
import type { ClientCreatorSelectionState } from "../constants";
import { formatCompactCount, formatEngagementPct, TO_BE_CONFIRMED } from "../format";
import { projectSelectionSummaryFromCards } from "../media-plan-summary";
import { buildClientReviewPath } from "../security/review-token";
import { isSelectedForCalculator } from "../status";
import type { ClientWorkspaceView } from "../types";
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
}: {
  view: ClientWorkspaceView;
  token: string;
  selection?: Record<string, ClientCreatorSelectionState>;
  variant?: "card" | "bar";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const resolvedSelection =
    selection ??
    Object.fromEntries(view.creators.map((creator) => [creator.creatorId, creator.selection]));
  const selectedCount = view.creators.filter((creator) =>
    isSelectedForCalculator(resolvedSelection[creator.creatorId])
  ).length;
  const currency = view.commercial.currency;
  const quotationTotal = view.commercial.quotationTotal;
  const investment = view.creators.reduce((sum, creator) => {
    if (!isSelectedForCalculator(resolvedSelection[creator.creatorId])) return sum;
    return sum + (creator.investmentAmount ?? 0);
  }, 0);
  const forecast = projectSelectionSummaryFromCards(view.creators, resolvedSelection, currency);
  const er =
    forecast.averageEngagementRate != null
      ? formatEngagementPct(forecast.averageEngagementRate)
      : TO_BE_CONFIRMED;
  const approvalHref = buildClientReviewPath(view.review.id, token, "approval");
  const feedbackHref = buildClientReviewPath(view.review.id, token, "feedback");
  const canApprove = view.canDecide && selectedCount > 0 && !pending;
  const emptyHint =
    selectedCount === 0 && view.canDecide
      ? "Select creators to calculate this package, then approve it."
      : null;

  function approve() {
    startTransition(async () => {
      const result = await decideReviewAction({ token, decision: "approved" });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (variant === "bar") {
    return (
      <div className="sumbar">
        <div className="sumbar-head">
          <p className="st">Selection calculator</p>
          <p className="ss">Updates as you select creators</p>
        </div>
        <div className="sumbar-metrics">
          <Metric
            label="Quotation"
            value={quotationTotal > 0 ? formatMoneyKpi(quotationTotal, currency) : TO_BE_CONFIRMED}
            missing={quotationTotal <= 0}
          />
          <Metric
            label="Investment"
            value={investment > 0 ? formatMoneyKpi(investment, currency) : TO_BE_CONFIRMED}
            missing={investment <= 0}
          />
          <Metric label="Creators" value={String(selectedCount)} />
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
          <Metric label="ER" value={er} missing={forecast.averageEngagementRate == null} />
          <Metric label="CPE" value={money(forecast.cpe, currency)} missing={forecast.cpe == null} />
          <Metric label="CPM" value={money(forecast.cpm, currency)} missing={forecast.cpm == null} />
        </div>
        {error ? <p className="sumbar-msg">{error}</p> : emptyHint ? <p className="sumbar-msg">{emptyHint}</p> : null}
        {view.canDecide ? (
          <div className="sumbar-cta">
            <button type="button" className="btn primary" disabled={!canApprove} onClick={approve}>
              <IconCheck />
              Approve selection
            </button>
            <Link className="btn ghost" href={feedbackHref}>
              Request changes
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="sumcard">
      <div className="h">
        <p className="st">Proposal summary</p>
        <p className="ss">
          {view.overview.campaignName} · v{view.review.reviewNumber}
        </p>
      </div>
      <Row
        label="Total quotation"
        value={quotationTotal > 0 ? formatMoneyKpi(quotationTotal, currency) : TO_BE_CONFIRMED}
        missing={quotationTotal <= 0}
      />
      <Row
        label="Investment"
        hint="based on selection"
        value={investment > 0 ? formatMoneyKpi(investment, currency) : TO_BE_CONFIRMED}
        missing={investment <= 0}
        big
      />
      <Row label="Creators" hint="based on selection" value={String(selectedCount)} />
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
        <p className="ss" style={{ color: "#ffb4b4", marginTop: 8 }}>
          {error}
        </p>
      ) : emptyHint ? (
        <p className="ss" style={{ marginTop: 8 }}>
          {emptyHint}
        </p>
      ) : null}
      {view.canDecide ? (
        <div className="sumcta">
          <button type="button" className="btn primary" disabled={!canApprove} onClick={approve}>
            <IconCheck />
            Approve selection
          </button>
          <Link
            className="btn"
            href={feedbackHref}
            style={{ background: "rgba(255,255,255,.08)", color: "#fff", borderColor: "rgba(255,255,255,.18)" }}
          >
            Request changes
          </Link>
          <Link
            className="btn"
            href={approvalHref}
            style={{ background: "transparent", color: "#cfd7ea", borderColor: "rgba(255,255,255,.12)" }}
          >
            Review approval page
          </Link>
        </div>
      ) : null}
    </div>
  );
}
