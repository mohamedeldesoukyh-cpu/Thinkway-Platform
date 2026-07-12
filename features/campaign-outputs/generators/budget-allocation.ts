/**
 * Budget Allocation Plan generator — splits the budget across creator fees,
 * paid amplification, and contingency, then distributes the creator-fee pool
 * across the slate by tier weight. Derives from budget + creators + platforms.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent } from "../output-types";
import { resolveSlate } from "../output-inputs";
import { formatMoney, tierRank } from "./generator-utils";

export const BUDGET_ALLOCATION_GENERATOR_VERSION = "1.0.0";

const PAID_SHARE = 0.2;
const CONTINGENCY_SHARE = 0.1;
/** Relative fee weight by tier rank (0=celebrity … 5=unclassified). */
const TIER_WEIGHT = [8, 5, 3, 2, 1.2, 1];

export function generateBudgetAllocation(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const budget = facts?.budget;
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const slate = resolveSlate(campaignObject);

  const currency = budget?.currency ?? "";
  const total = budget?.amount ?? 0;
  const paid = Math.round(total * PAID_SHARE);
  const contingency = Math.round(total * CONTINGENCY_SHARE);
  const creatorPool = total - paid - contingency;

  const weights = slate.map((c) => TIER_WEIGHT[tierRank(c.tier)] ?? 1);
  const weightSum = weights.reduce((n, w) => n + w, 0) || 1;
  const creatorRows = slate.map((c, i) => {
    const alloc = Math.round((weights[i]! / weightSum) * creatorPool);
    const pct = total > 0 ? Math.round((alloc / total) * 100) : 0;
    return { creator: c.displayName, tier: c.tier ?? "—", alloc, pct };
  });

  const sections: CampaignOutputContent["sections"] = [
    {
      heading: "Allocation Summary",
      items: budget
        ? [
            `Total budget: ${formatMoney(total, currency)}`,
            `Creator fees: ${formatMoney(creatorPool, currency)} (${Math.round((creatorPool / total) * 100)}%)`,
            `Paid amplification: ${formatMoney(paid, currency)} (${Math.round(PAID_SHARE * 100)}%)`,
            `Contingency reserve: ${formatMoney(contingency, currency)} (${Math.round(CONTINGENCY_SHARE * 100)}%)`,
          ]
        : ["Budget not yet confirmed — allocation will compute once a budget is set."],
    },
    {
      heading: "Creator Fee Allocation",
      table: {
        columns: ["Creator", "Tier", "Allocation", "% of total"],
        rows: creatorRows.length
          ? creatorRows.map((r) => [r.creator, r.tier, formatMoney(r.alloc, currency), `${r.pct}%`])
          : [["—", "—", "—", "—"]],
      },
    },
    {
      heading: "Platform Split",
      items: platforms.map(
        (p) => `${p}: fees distributed to creators active on ${p}; paid budget concentrated on the primary platform`
      ),
    },
    {
      heading: "Recommendations",
      items: [
        "Weight fees toward lead tiers for reach, but protect a micro/nano layer for authenticity",
        "Release the contingency reserve only during the optimization window",
        "Reconcile allocation against actual creator quotes before client sign-off",
      ],
    },
  ];

  return {
    title: "Budget Allocation Plan",
    summary: budget
      ? `${formatMoney(total, currency)} split across ${slate.length} creator${slate.length === 1 ? "" : "s"}, paid amplification, and contingency.`
      : "Budget allocation pending a confirmed budget.",
    sections,
    data: { currency, total, creatorPool, paid, contingency, creatorRows },
  };
}
