/**
 * Internal Operations Plan generator — the agency-facing execution plan:
 * production workflow, approvals & QA, reporting cadence, responsibilities, and
 * deliverables tracking. Derives from creators + timeline + platforms +
 * deliverables scope.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent } from "../output-types";
import { resolveSlate } from "../output-inputs";

export const INTERNAL_OPERATIONS_GENERATOR_VERSION = "1.0.0";

export function generateInternalOperations(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const slate = resolveSlate(campaignObject);
  const durationWeeks = facts?.durationWeeks;
  const platforms = facts?.platforms ?? [];
  const deliverables = facts?.deliverables ?? [];

  return {
    title: "Internal Operations Plan",
    summary: `Internal execution plan for ${slate.length} creator${slate.length === 1 ? "" : "s"}${durationWeeks ? ` over ${durationWeeks} weeks` : ""}.`,
    sections: [
      {
        heading: "Production Workflow",
        items: [
          "Brief creators against the strategy and lock content concepts",
          "Assets delivered ≥3 days before publish; production starts ≥7 days before",
          "Brand review cycle on every asset before scheduling",
          "Schedule posts to platform peak hours per the Media Plan",
        ],
      },
      {
        heading: "Approvals & QA",
        items: [
          "Client sign-off on content and schedule before launch",
          "Mid-campaign client checkpoint at the halfway mark",
          "QA each post for brand safety, disclosure/#ad compliance, and links",
        ],
      },
      {
        heading: "Reporting Cadence",
        items: [
          "Weekly performance review with the client",
          "Optimization readout before the optimization window",
          "End-of-campaign report: results, insights, and recommendations",
        ],
      },
      {
        heading: "Responsibilities",
        items: [
          "Account Manager — client comms, approvals, timeline",
          "Campaign Manager — creator coordination, scheduling, delivery",
          "Analyst — tracking, optimization signals, reporting",
        ],
      },
      {
        heading: "Deliverables Tracking",
        items: deliverables.length
          ? deliverables.map((d) => `Track: ${d}`)
          : ["Deliverables scope to be confirmed"],
      },
      {
        heading: "Channels",
        body: platforms.length ? `Active platforms: ${platforms.join(", ")}.` : "Platforms to be confirmed.",
      },
    ],
    data: { durationWeeks, platforms, deliverables, creatorCount: slate.length },
  };
}
