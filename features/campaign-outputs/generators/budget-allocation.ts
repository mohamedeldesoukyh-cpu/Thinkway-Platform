/**
 * Budget Allocation Plan — allocates the campaign budget to creators.
 *
 * When quotation line fees are present on the slate, those exact amounts are
 * used (creator fees only). Otherwise fees are distributed across the slate.
 * Paid amplification, contingency, and usage rights appear only when the brief
 * or CampaignFacts explicitly require them — default is 100% creator fees.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  briefRequiresOptionalCategories,
  detectBudgetSplitKeywords,
} from "@/features/campaign-director/services/budget-rules";

import type { CampaignOutputContent } from "../output-types";
import { resolveSlate } from "../output-inputs";
import { formatMoney, tierRank } from "./generator-utils";

export const BUDGET_ALLOCATION_GENERATOR_VERSION = "2.0.0";

const TIER_WEIGHT = [8, 5, 3, 2, 1.2, 1];

type CreatorAllocationRow = {
  creator: string;
  tier: string;
  platform: string;
  alloc: number;
  pct: number;
};

function briefTextForBudget(campaignObject: CampaignObject): string {
  const facts = getCampaignFacts(campaignObject);
  const strategy =
    typeof campaignObject.sections.strategy?.content === "string"
      ? campaignObject.sections.strategy.content
      : "";
  return [facts?.rawBriefExcerpt, facts?.objective, strategy].filter(Boolean).join("\n");
}

function distributeByTier(
  slate: ReturnType<typeof resolveSlate>,
  pool: number
): CreatorAllocationRow[] {
  const weights = slate.map((c) => TIER_WEIGHT[tierRank(c.tier)] ?? 1);
  const weightSum = weights.reduce((n, w) => n + w, 0) || 1;
  return slate.map((c, i) => {
    const alloc = Math.round((weights[i]! / weightSum) * pool);
    return {
      creator: c.displayName,
      tier: c.tier ?? "—",
      platform: c.platform ?? "—",
      alloc,
      pct: pool > 0 ? Math.round((alloc / pool) * 100) : 0,
    };
  });
}

function resolveQuotedAllocations(
  slate: ReturnType<typeof resolveSlate>,
  total: number,
  currency: string
): { rows: CreatorAllocationRow[]; quotedTotal: number } | null {
  const withQuotes = slate.filter((c) => (c.quotedRevenue ?? 0) > 0);
  if (withQuotes.length === 0) return null;

  const quotedTotal = withQuotes.reduce((sum, c) => sum + (c.quotedRevenue ?? 0), 0);
  const rows: CreatorAllocationRow[] = slate.map((c) => {
    const alloc = c.quotedRevenue && c.quotedRevenue > 0 ? Math.round(c.quotedRevenue) : 0;
    const pct = total > 0 ? Math.round((alloc / total) * 100) : 0;
    return {
      creator: c.displayName,
      tier: c.tier ?? "—",
      platform: c.platform ?? "—",
      alloc,
      pct,
    };
  });

  return { rows, quotedTotal };
}

export function generateBudgetAllocation(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const budget = facts?.budget;
  const slate = resolveSlate(campaignObject);
  const briefText = briefTextForBudget(campaignObject);

  const currency = budget?.currency ?? slate.find((c) => c.quotedCurrency)?.quotedCurrency ?? "";
  const total = budget?.amount ?? 0;

  const splitKeywords = detectBudgetSplitKeywords(briefText, facts);
  const allowOptionalLines = briefRequiresOptionalCategories(briefText, facts);

  const quoted = resolveQuotedAllocations(slate, total, currency);
  const creatorPool = quoted
    ? quoted.quotedTotal
    : allowOptionalLines
      ? Math.round(total * 0.7)
      : total;

  let paid = 0;
  let contingency = 0;
  let usageRights = 0;

  if (allowOptionalLines && total > 0) {
    const wantsPaid = splitKeywords.some((k) =>
      /paid|boost/i.test(k.keyword)
    );
    const wantsContingency = splitKeywords.some((k) => /contingency/i.test(k.keyword));
    const wantsUsage = splitKeywords.some((k) => /usage/i.test(k.keyword));

    if (wantsPaid) paid = Math.round(total * 0.15);
    if (wantsContingency) contingency = Math.round(total * 0.1);
    if (wantsUsage) usageRights = Math.round(total * 0.05);

    if (!quoted && wantsPaid && !wantsContingency && !wantsUsage) {
      paid = Math.round(total * 0.2);
      contingency = Math.round(total * 0.1);
    }
  }

  const creatorRows = quoted
    ? quoted.rows
    : distributeByTier(slate, creatorPool > 0 ? creatorPool : total);

  const creatorFeesTotal = quoted
    ? quoted.quotedTotal
    : creatorRows.reduce((sum, row) => sum + row.alloc, 0);

  const summaryItems: string[] = [];
  if (budget) {
    summaryItems.push(`Total budget: ${formatMoney(total, currency)}`);
    summaryItems.push(
      `Creator fees: ${formatMoney(creatorFeesTotal, currency)} (${total > 0 ? Math.round((creatorFeesTotal / total) * 100) : 100}%)`
    );
    if (paid > 0) {
      summaryItems.push(
        `Paid amplification: ${formatMoney(paid, currency)} (${total > 0 ? Math.round((paid / total) * 100) : 0}%)`
      );
    }
    if (usageRights > 0) {
      summaryItems.push(
        `Usage rights: ${formatMoney(usageRights, currency)} (${total > 0 ? Math.round((usageRights / total) * 100) : 0}%)`
      );
    }
    if (contingency > 0) {
      summaryItems.push(
        `Contingency reserve: ${formatMoney(contingency, currency)} (${total > 0 ? Math.round((contingency / total) * 100) : 0}%)`
      );
    }
  } else {
    summaryItems.push("Budget not yet confirmed — allocation will compute once a budget is set.");
  }

  if (quoted) {
    summaryItems.push(
      "Fees sourced from quotation line items — each creator allocation matches the quoted revenue."
    );
  } else if (!allowOptionalLines) {
    summaryItems.push(
      "100% creator fees — production is embedded in creator fees unless the brief requests separate lines."
    );
  }

  const platforms = [
    ...new Set(slate.map((c) => c.platform).filter((p): p is string => Boolean(p?.trim()))),
  ];

  const sections: CampaignOutputContent["sections"] = [
    { heading: "Allocation Summary", items: summaryItems },
    {
      heading: "Creator Fee Allocation",
      table: {
        columns: ["Creator", "Tier", "Platform", "Allocation", "% of total"],
        rows: creatorRows.length
          ? creatorRows.map((r) => [
              r.creator,
              r.tier,
              r.platform,
              formatMoney(r.alloc, currency),
              `${total > 0 ? Math.round((r.alloc / total) * 100) : r.pct}%`,
            ])
          : [["—", "—", "—", "—", "—"]],
      },
    },
  ];

  if (platforms.length) {
    sections.push({
      heading: "Platform Split",
      items: platforms.map(
        (p) =>
          `${p}: ${creatorRows.filter((r) => r.platform.toLowerCase() === p.toLowerCase()).length} creator${creatorRows.filter((r) => r.platform.toLowerCase() === p.toLowerCase()).length === 1 ? "" : "s"} · ${formatMoney(
            creatorRows
              .filter((r) => r.platform.toLowerCase() === p.toLowerCase())
              .reduce((sum, r) => sum + r.alloc, 0),
            currency
          )} in creator fees`
      ),
    });
  }

  sections.push({
    heading: "Recommendations",
    items: quoted
      ? [
          "Allocations match the approved quotation — reconcile any scope changes before client sign-off",
          "Usage rights and paid amplification are excluded unless quoted separately",
        ]
      : [
          "Reconcile tier-weighted allocations against actual creator quotes before client sign-off",
          "Request separate quotation lines for usage rights or paid amplification when required",
        ],
  });

  const summary = budget
    ? quoted
      ? `${formatMoney(creatorFeesTotal, currency)} in creator fees across ${slate.length} creator${slate.length === 1 ? "" : "s"} (from quotation).`
      : allowOptionalLines
        ? `${formatMoney(total, currency)} allocated across ${slate.length} creator${slate.length === 1 ? "" : "s"} and optional budget lines.`
        : `${formatMoney(total, currency)} allocated to ${slate.length} creator${slate.length === 1 ? "" : "s"} as creator fees.`
    : "Budget allocation pending a confirmed budget.";

  return {
    title: "Budget Allocation Plan",
    summary,
    sections,
    data: {
      currency,
      total,
      creatorFeesTotal,
      creatorPool: creatorFeesTotal,
      paid,
      contingency,
      usageRights,
      creatorRows,
      quotedFromCommercial: Boolean(quoted),
    },
  };
}
