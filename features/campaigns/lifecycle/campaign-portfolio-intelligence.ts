/**
 * Portfolio operational intelligence — presentation only.
 * Derives Waiting For, Days Waiting, and Risk from existing lifecycle cues + dates.
 * No API / DB / workflow changes.
 */

import {
  campaignLifecycleFromListItem,
  type CampaignLifecycleView,
} from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignListItem } from "@/types/database";

export type CampaignRiskLevel = "low" | "watch" | "elevated" | "critical";

export type CampaignPortfolioIntel = {
  businessStageLabel: string;
  businessStateLabel: string;
  waitingFor: string;
  daysWaiting: number | null;
  daysWaitingLabel: string;
  risk: CampaignRiskLevel;
  riskLabel: string;
  nextAction: string;
  nextActionTab: CampaignWorkspaceTabId;
  owner: string;
  reason: string;
};

function calendarDaysBetween(fromIso: string, to: Date = new Date()): number {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function isPastEnd(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  const end = new Date(`${endDate}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

/** Days in current waiting / attention posture (updated_at as last movement proxy). */
export function deriveDaysWaiting(
  lifecycle: CampaignLifecycleView,
  updatedAt: string | null | undefined
): number | null {
  if (!updatedAt) return null;
  if (
    lifecycle.businessState !== "waiting" &&
    lifecycle.businessState !== "needs_attention" &&
    lifecycle.businessState !== "blocked"
  ) {
    return null;
  }
  return calendarDaysBetween(updatedAt);
}

export function deriveCampaignRisk(
  lifecycle: CampaignLifecycleView,
  daysWaiting: number | null,
  endDate: string | null | undefined
): { risk: CampaignRiskLevel; riskLabel: string } {
  if (lifecycle.businessState === "blocked") {
    return { risk: "critical", riskLabel: "Critical" };
  }
  if (lifecycle.businessState === "needs_attention") {
    return { risk: "elevated", riskLabel: "Elevated" };
  }
  if (isPastEnd(endDate) && lifecycle.businessState !== "completed" && lifecycle.businessState !== "closed") {
    return { risk: "elevated", riskLabel: "Past end date" };
  }
  if (lifecycle.businessState === "waiting") {
    if (daysWaiting != null && daysWaiting >= 14) {
      return { risk: "critical", riskLabel: "Stalled" };
    }
    if (daysWaiting != null && daysWaiting >= 7) {
      return { risk: "elevated", riskLabel: "Elevated" };
    }
    return { risk: "watch", riskLabel: "Watch" };
  }
  if (lifecycle.businessState === "ready" || lifecycle.businessState === "in_progress") {
    return { risk: "low", riskLabel: "On track" };
  }
  return { risk: "low", riskLabel: "Low" };
}

export function campaignPortfolioIntel(campaign: CampaignListItem): CampaignPortfolioIntel {
  const lifecycle = campaignLifecycleFromListItem(campaign);
  const daysWaiting = deriveDaysWaiting(lifecycle, campaign.updated_at);
  const { risk, riskLabel } = deriveCampaignRisk(
    lifecycle,
    daysWaiting,
    campaign.end_date
  );

  const waitingFor =
    lifecycle.waitingFor !== "None"
      ? lifecycle.waitingFor
      : lifecycle.businessState === "waiting"
        ? lifecycle.owner
        : "—";

  return {
    businessStageLabel: lifecycle.businessStageLabel,
    businessStateLabel: lifecycle.businessStateLabel,
    waitingFor,
    daysWaiting,
    daysWaitingLabel: daysWaiting == null ? "—" : `${daysWaiting}d`,
    risk,
    riskLabel,
    nextAction: lifecycle.nextAction,
    nextActionTab: lifecycle.nextActionTab,
    owner: lifecycle.owner,
    reason: lifecycle.reason,
  };
}

export function portfolioIntelFromLifecycle(
  lifecycle: CampaignLifecycleView,
  dates: { updatedAt?: string | null; endDate?: string | null }
): CampaignPortfolioIntel {
  const daysWaiting = deriveDaysWaiting(lifecycle, dates.updatedAt);
  const { risk, riskLabel } = deriveCampaignRisk(lifecycle, daysWaiting, dates.endDate);
  const waitingFor =
    lifecycle.waitingFor !== "None"
      ? lifecycle.waitingFor
      : lifecycle.businessState === "waiting"
        ? lifecycle.owner
        : "—";

  return {
    businessStageLabel: lifecycle.businessStageLabel,
    businessStateLabel: lifecycle.businessStateLabel,
    waitingFor,
    daysWaiting,
    daysWaitingLabel: daysWaiting == null ? "—" : `${daysWaiting}d`,
    risk,
    riskLabel,
    nextAction: lifecycle.nextAction,
    nextActionTab: lifecycle.nextActionTab,
    owner: lifecycle.owner,
    reason: lifecycle.reason,
  };
}
