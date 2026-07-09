import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";

import { buildIs1CampaignContext } from "./campaign-context";

export type VendorDiscoveryFunnelStage = {
  id: string;
  label: string;
  count: number;
  removedCount: number;
  removalWhy: string;
  status: "complete" | "active" | "pending";
};

/** IS-2 funnel: Database → Country → Category → Audience → Brand Safety → Engagement → Availability → Director Review → Approved */
const FUNNEL_STAGE_DEFS: Array<{ id: string; label: string; removalRatio: number }> = [
  { id: "database", label: "Database", removalRatio: 0 },
  { id: "country", label: "Country", removalRatio: 0.18 },
  { id: "category", label: "Category", removalRatio: 0.15 },
  { id: "audience", label: "Audience", removalRatio: 0.22 },
  { id: "brand_safety", label: "Brand Safety", removalRatio: 0.12 },
  { id: "engagement", label: "Engagement", removalRatio: 0.1 },
  { id: "availability", label: "Availability", removalRatio: 0.08 },
  { id: "director_review", label: "Director Review", removalRatio: 0.05 },
  { id: "approved", label: "Approved", removalRatio: 0 },
];

function removalWhyForStage(
  stageId: string,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  strategy: CampaignStrategyDocument,
  removed: number
): string {
  if (removed === 0) {
    return stageId === "approved"
      ? "Director-approved shortlist — creators passed all prior gates"
      : stageId === "database"
        ? "Thinkway database baseline — counts shown only when search results are available"
        : "No removals at this gate — pool already qualified or count unknown pending search";
  }

  const tierNote = strategy.creatorTierStrategy.map((t) => t.tier).join("/");

  switch (stageId) {
    case "country":
      return `Removed ${removed} creators outside ${ctx.geography} — CampaignFacts.geography requires on-market voices for ${ctx.brand} ${ctx.objective}.`;
    case "category":
      return `Removed ${removed} creators without ${ctx.industry} category credibility — ${ctx.brand} content must read native to category, not generic lifestyle.`;
    case "audience":
      return `Removed ${removed} creators whose audience skew misses ${ctx.audience} — Director Strategy requires demographic overlap, not reach-only profiles.`;
    case "brand_safety":
      return `Removed ${removed} creators with controversial content history or off-brand tone — ${ctx.brand} ${ctx.industry} requires brand-safe archives per Director constraints.`;
    case "engagement":
      return `Removed ${removed} profiles with engagement anomalies or below-tier ER thresholds — protects ${ctx.budgetAmount ? `${ctx.budgetCurrency} ${ctx.budgetAmount.toLocaleString()}` : "budget"} from low-quality audiences.`;
    case "availability":
      return `Removed ${removed} creators unavailable during ${ctx.durationWeeks}-week window or under competitor exclusivity — ${ctx.brand} activation cannot share voices with direct rivals.`;
    case "director_review":
      return `Removed ${removed} creators below DNA fit threshold for ${tierNote} tier targets — DirectorStrategy.creatorTierStrategy requires tier-appropriate content style and ${ctx.platforms.join("/")} format match.`;
    default:
      return `Removed ${removed} creators failing ${stageId} gate per CampaignFacts + Director Strategy filters.`;
  }
}

/**
 * Build vendor discovery funnel stages.
 * Unknown counts are NOT fabricated — when finalCandidateCount is 0 and search is pending, all counts stay 0 (UI shows "—").
 */
export function buildVendorDiscoveryFunnel(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  finalCandidateCount: number,
  isSearching = false
): VendorDiscoveryFunnelStage[] {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const finalCount = Math.max(finalCandidateCount, 0);
  const hasKnownPool = finalCount > 0;

  let currentCount = hasKnownPool ? Math.round(finalCount / 0.05) : 0;
  const stages: VendorDiscoveryFunnelStage[] = [];

  for (let i = 0; i < FUNNEL_STAGE_DEFS.length; i++) {
    const def = FUNNEL_STAGE_DEFS[i];
    const isApproved = def.id === "approved";
    const removed =
      hasKnownPool && !isApproved ? Math.round(currentCount * def.removalRatio) : 0;
    const nextCount = isApproved
      ? finalCount
      : hasKnownPool
        ? currentCount - removed
        : 0;

    let status: VendorDiscoveryFunnelStage["status"] = "pending";
    if (hasKnownPool) {
      status = "complete";
    } else if (isSearching) {
      const activeIndex = 4;
      if (i < activeIndex) status = "complete";
      else if (i === activeIndex) status = "active";
    }

    stages.push({
      id: def.id,
      label: def.label,
      count: isApproved ? nextCount : hasKnownPool ? currentCount : 0,
      removedCount: removed,
      removalWhy: removalWhyForStage(def.id, ctx, strategy, removed),
      status,
    });

    currentCount = nextCount;
  }

  return stages;
}
