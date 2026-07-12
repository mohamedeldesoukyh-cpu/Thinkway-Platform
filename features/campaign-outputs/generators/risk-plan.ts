/**
 * Risk & Mitigation Plan generator — deterministic risk assessment derived from
 * slate composition, timeline, market, and any declared risks.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent } from "../output-types";
import { resolveSlate } from "../output-inputs";
import { tierCounts } from "./generator-utils";

export const RISK_PLAN_GENERATOR_VERSION = "1.0.0";

type Risk = { risk: string; likelihood: "Low" | "Medium" | "High"; impact: "Low" | "Medium" | "High"; mitigation: string };

export function generateRiskPlan(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const slate = resolveSlate(campaignObject);
  const durationWeeks = facts?.durationWeeks;
  const markets = facts?.geography ?? [];
  const declared = facts?.risks ?? [];

  const risks: Risk[] = [];
  const counts = tierCounts(slate);
  const dominantTier = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (dominantTier && slate.length > 0 && dominantTier[1] / slate.length > 0.6) {
    risks.push({
      risk: `Audience overlap — ${dominantTier[0]} creators dominate the slate (${dominantTier[1]}/${slate.length})`,
      likelihood: "Medium",
      impact: "Medium",
      mitigation: "Diversify tiers/niches to broaden unique reach and reduce duplicate audiences",
    });
  }
  if (slate.length > 0 && slate.length < 3) {
    risks.push({
      risk: "Limited reach — the slate is small, concentrating delivery risk on few creators",
      likelihood: "Medium",
      impact: "High",
      mitigation: "Add mid/micro creators to spread reach and protect against a single drop-out",
    });
  }
  if (durationWeeks !== undefined && durationWeeks <= 2) {
    risks.push({
      risk: "Compressed timeline — a short flight leaves little room for production or reshoots",
      likelihood: "High",
      impact: "Medium",
      mitigation: "Lock assets early, front-load approvals, and hold a contingency day",
    });
  }
  if (markets.length === 1) {
    risks.push({
      risk: `Single-market concentration (${markets[0]}) — no geographic hedge`,
      likelihood: "Low",
      impact: "Medium",
      mitigation: "Monitor market-level performance closely; keep budget flexible to reallocate",
    });
  }
  for (const declaredRisk of declared) {
    risks.push({
      risk: declaredRisk,
      likelihood: "Medium",
      impact: "Medium",
      mitigation: "Track against the campaign plan and escalate early if it materializes",
    });
  }
  if (risks.length === 0) {
    risks.push({
      risk: "No material risks flagged from the current inputs",
      likelihood: "Low",
      impact: "Low",
      mitigation: "Maintain standard delivery monitoring and engagement-quality checks",
    });
  }

  return {
    title: "Risk & Mitigation Plan",
    summary: `${risks.length} risk${risks.length === 1 ? "" : "s"} identified across slate, timeline, and market, each with a mitigation.`,
    sections: [
      {
        heading: "Risk Register",
        table: {
          columns: ["Risk", "Likelihood", "Impact", "Mitigation"],
          rows: risks.map((r) => [r.risk, r.likelihood, r.impact, r.mitigation]),
        },
      },
      {
        heading: "Contingency Principles",
        items: [
          "Hold a contingency window before campaign end for reshoots or rescheduled posts",
          "Keep 10% budget flexibility to reallocate toward top performers",
          "Escalate any at-risk deliverable at the weekly review, not at launch",
        ],
      },
    ],
    data: { risks },
  };
}
