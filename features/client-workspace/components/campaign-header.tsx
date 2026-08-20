"use client";

import Link from "next/link";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  CLIENT_PROPOSAL_STATUS_LABEL,
  type ClientReviewStatus,
} from "../constants";
import { formatPlatformLabel } from "../format";
import { proposalSubtitle, rosterHeadline, rosterSourceLine } from "../presentation";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceView } from "../types";
import { StatusPill } from "./media-plan-ui";

function statusTone(status: ClientReviewStatus): "neutral" | "positive" | "warning" | "danger" {
  if (status === "approved") return "positive";
  if (status === "changes_requested" || status === "superseded") return "warning";
  if (status === "rejected" || status === "revoked") return "danger";
  return "neutral";
}

export function CampaignHeader({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const count = view.creators.length;
  const platforms = view.overview.platforms
    .map((platform) => formatPlatformLabel(platform) ?? platform)
    .filter(Boolean);
  const market = view.overview.market?.trim();
  const duration = view.overview.durationLabel?.trim();
  const investment =
    view.commercial.totalInvestment > 0
      ? formatMoneyKpi(view.commercial.totalInvestment, view.commercial.currency)
      : null;
  const meta = [
    `Proposal v${view.review.reviewNumber}`,
    rosterHeadline(count),
    platforms.length > 0 ? platforms.join(" · ") : null,
    market || null,
    duration || null,
    investment,
  ].filter((item): item is string => Boolean(item));
  const approvalHref = buildClientReviewPath(view.journey?.canonicalReviewId ?? view.review.id, token, "approval");
  const feedbackHref = buildClientReviewPath(view.journey?.canonicalReviewId ?? view.review.id, token, "feedback");

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {view.overview.brandName}
          {view.overview.clientLabel && view.overview.clientLabel !== view.overview.brandName
            ? ` · ${view.overview.clientLabel}`
            : ""}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {view.overview.campaignName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{proposalSubtitle()}</p>
        <p className="mt-3 text-sm text-zinc-600">{meta.join(" · ")}</p>
        <p className="mt-1 text-xs text-zinc-400">{rosterSourceLine(view.review.source)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={statusTone(view.review.status)}>
          {CLIENT_PROPOSAL_STATUS_LABEL[view.review.status]}
        </StatusPill>
        {view.newerReviewNumber ? (
          <StatusPill tone="warning">Proposal v{view.newerReviewNumber} available</StatusPill>
        ) : (
          <StatusPill>Current</StatusPill>
        )}
        {view.canDecide ? (
          <>
            <Link
              href={feedbackHref}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Request changes
            </Link>
            <Link
              href={approvalHref}
              className="rounded-full bg-[#1D9E75] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#178A65]"
            >
              {view.journey?.canApproveQuotation
                ? "Approve Quotation"
                : view.journey?.canApproveShortlist
                  ? "Approve Shortlist"
                  : "Review approval"}
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
