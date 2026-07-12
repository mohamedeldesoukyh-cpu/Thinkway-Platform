/**
 * Executive Proposal generator — the client-facing proposal narrative, assembled
 * as a derived view from objective, audience, creators, budget, timeline, KPIs,
 * and the strategy section. Never invents facts.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent } from "../output-types";
import { resolveSlate } from "../output-inputs";
import { formatMoney, tierCounts, tierRank } from "./generator-utils";

export const EXECUTIVE_PROPOSAL_GENERATOR_VERSION = "1.0.0";

export function generateExecutiveProposal(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const slate = [...resolveSlate(campaignObject)].sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
  const brand = facts?.brandName ?? facts?.clientName ?? "the brand";
  const objective = facts?.objective;
  const audience = facts?.audience;
  const budget = facts?.budget;
  const durationWeeks = facts?.durationWeeks;
  const kpis = facts?.kpis ?? [];

  const strategyNarrative =
    typeof campaignObject.sections.strategy?.content === "string"
      ? campaignObject.sections.strategy.content.trim()
      : "";

  const mix = Object.entries(tierCounts(slate)).map(([tier, count]) => `${count} × ${tier}`);

  const sections: CampaignOutputContent["sections"] = [
    {
      heading: "Overview",
      body: `A proposal for ${brand}${durationWeeks ? ` over ${durationWeeks} weeks` : ""}${objective ? `, built to ${objective}` : ""}.`,
    },
  ];
  if (objective) sections.push({ heading: "Objective", body: objective });
  if (audience) sections.push({ heading: "Audience", body: audience });
  if (strategyNarrative) {
    sections.push({ heading: "Recommended Approach", body: strategyNarrative.slice(0, 800) });
  }
  sections.push({
    heading: "Creator Lineup",
    items: slate.length ? [...mix, ...slate.slice(0, 8).map((c) => `${c.displayName}${c.tier ? ` (${c.tier})` : ""}`)] : ["Creator slate to be finalized"],
  });
  if (budget) {
    sections.push({
      heading: "Investment",
      body: `Total investment: ${formatMoney(budget.amount, budget.currency)}, covering creator fees, paid amplification, and production.`,
    });
  }
  sections.push({
    heading: "Timeline",
    body: durationWeeks
      ? `${durationWeeks}-week flight: launch, sustain, optimize, and report.`
      : "Timeline to be confirmed.",
  });
  if (kpis.length) sections.push({ heading: "Expected Outcomes", items: kpis });
  sections.push({
    heading: "Next Steps",
    items: [
      "Approve the creator lineup and budget",
      "Confirm the campaign timeline and key dates",
      "Kick off production against the Media Plan",
    ],
  });

  return {
    title: "Executive Proposal",
    summary: `Client proposal for ${brand}${objective ? ` — ${objective}` : ""}.`,
    sections,
  };
}
