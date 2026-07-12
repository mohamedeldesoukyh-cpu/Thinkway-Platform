/**
 * Amplification Plan generator — the paid layer over the organic plan. Derived
 * from the slate (which creators to boost), platforms (which paid product), and
 * budget (how much to hold for paid).
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent } from "../output-types";
import { resolveSlate, type SlateCreator } from "../output-inputs";
import { formatMoney, tierRank } from "./generator-utils";

export const AMPLIFICATION_PLAN_GENERATOR_VERSION = "1.0.0";

const PAID_SHARE = 0.2; // recommend ~20% of budget to paid amplification

function paidProduct(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes("tiktok")) return "Spark Ads";
  if (p.includes("youtube")) return "YouTube Ads";
  return "Boosted Post / Whitelisting";
}

export function generateAmplificationPlan(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const slate = resolveSlate(campaignObject);
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const budget = facts?.budget;
  const paidBudget = budget ? Math.round(budget.amount * PAID_SHARE) : undefined;

  // Boost the top-performing tiers first; whitelist the leads.
  const boostTargets = [...slate]
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier))
    .slice(0, Math.max(1, Math.ceil(slate.length / 2)));

  const primaryPlatform = platforms[0]!;

  const rows = boostTargets.map((creator: SlateCreator) => {
    const isLead = tierRank(creator.tier) <= 1;
    return [
      creator.displayName,
      creator.tier ?? "—",
      paidProduct(primaryPlatform),
      isLead ? "Whitelist + boost from day one to maximize reach" : "Boost after organic engagement stabilizes",
    ];
  });

  const sections: CampaignOutputContent["sections"] = [
    {
      heading: "Paid Strategy",
      items: [
        budget
          ? `Recommended paid budget: ${formatMoney(paidBudget ?? 0, budget.currency)} (~${Math.round(PAID_SHARE * 100)}% of total)`
          : "Recommended paid budget: ~20% of total, once budget is confirmed",
        `Primary paid product: ${paidProduct(primaryPlatform)} on ${primaryPlatform}`,
        "Layer paid on top of the highest-performing organic content, not indiscriminately",
      ],
    },
    {
      heading: "Boost Targets",
      table: {
        columns: ["Creator", "Tier", "Paid product", "Approach"],
        rows: rows.length ? rows : [["—", "—", paidProduct(primaryPlatform), "Add creators to define boost targets"]],
      },
    },
    {
      heading: "Amplification Windows",
      items: [
        "Launch week: whitelist + Spark Ads on lead creators to accelerate reach",
        "Mid-campaign: boost the top organic performers once engagement stabilizes",
        "Optimization window: shift remaining paid budget to the best CPM/CPE performers",
      ],
    },
    {
      heading: "Recommendations",
      items: [
        "Delay broad paid amplification until organic engagement signals winners",
        "Use whitelisting on lead creators for the most efficient reach",
        "Cap spend per creator and reallocate weekly based on performance",
      ],
    },
  ];

  return {
    title: "Amplification Plan",
    summary: `Paid amplification across ${boostTargets.length} boost target${boostTargets.length === 1 ? "" : "s"}${budget ? ` on a ${formatMoney(paidBudget ?? 0, budget.currency)} paid budget` : ""}.`,
    sections,
    data: { paidShare: PAID_SHARE, paidBudget, primaryPlatform, boostTargets: boostTargets.map((c) => c.displayName) },
  };
}
