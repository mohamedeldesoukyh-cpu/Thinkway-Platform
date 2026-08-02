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

export type VendorDiscoveryFunnelOptions = {
  /** Measured search / screened pool size when known. Never invent this. */
  initialPoolCount?: number;
};

/** IS-2 funnel: Database → Country → Category → Audience → Brand Safety → Engagement → Availability → Director Review → Approved */
const FUNNEL_STAGE_DEFS: Array<{ id: string; label: string }> = [
  { id: "database", label: "Database" },
  { id: "country", label: "Country" },
  { id: "category", label: "Category" },
  { id: "audience", label: "Audience" },
  { id: "brand_safety", label: "Brand Safety" },
  { id: "engagement", label: "Engagement" },
  { id: "availability", label: "Availability" },
  { id: "director_review", label: "Director Review" },
  { id: "approved", label: "Approved" },
];

function removalWhyForStage(
  stageId: string,
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  removed: number,
  hasMeasuredPool: boolean
): string {
  if (removed === 0) {
    if (stageId === "approved") {
      return "Director-approved shortlist — creators that remain after Campaign Intelligence filtering";
    }
    if (stageId === "database") {
      return hasMeasuredPool
        ? "Measured Campaign Intelligence search pool for this brief"
        : "Approved shortlist size (stage-level pool sizes were not measured in this run)";
    }
    return hasMeasuredPool
      ? "No measured removals persisted at this gate for this run"
      : "Intermediate gate counts not instrumented — showing approved shortlist size only";
  }

  switch (stageId) {
    case "director_review":
      return `Narrowed ${removed} creator${removed === 1 ? "" : "s"} during Campaign Intelligence filtering for ${ctx.brand} in ${ctx.geography}`;
    case "country":
      return `Removed ${removed} creators outside ${ctx.geography}`;
    default:
      return `Narrowed ${removed} creator${removed === 1 ? "" : "s"} during ${stageId.replace(/_/g, " ")} filtering`;
  }
}

/**
 * Build vendor discovery funnel stages.
 * Unknown stage counts are NEVER fabricated from ratios.
 * When only the approved count is known, every stage shows that count with zero invented removals.
 * When an initial pool is measured and larger than approved, the reduction is attributed once to Director Review.
 */
export function buildVendorDiscoveryFunnel(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  finalCandidateCount: number,
  isSearching = false,
  options?: VendorDiscoveryFunnelOptions
): VendorDiscoveryFunnelStage[] {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const finalCount = Math.max(finalCandidateCount, 0);
  const hasKnownPool = finalCount > 0;
  const measuredPool =
    typeof options?.initialPoolCount === "number" && options.initialPoolCount > 0
      ? Math.max(options.initialPoolCount, finalCount)
      : null;
  const hasMeasuredPool = measuredPool != null && measuredPool > finalCount;
  const poolStart = measuredPool ?? finalCount;

  return FUNNEL_STAGE_DEFS.map((def, i) => {
    const isApproved = def.id === "approved";
    const isDirector = def.id === "director_review";
    const count = isApproved ? finalCount : hasKnownPool ? poolStart : 0;
    const removed =
      hasMeasuredPool && isDirector ? Math.max(0, poolStart - finalCount) : 0;

    let status: VendorDiscoveryFunnelStage["status"] = "pending";
    if (hasKnownPool) {
      status = "complete";
    } else if (isSearching) {
      const activeIndex = 4;
      if (i < activeIndex) status = "complete";
      else if (i === activeIndex) status = "active";
    }

    return {
      id: def.id,
      label: def.label,
      count,
      removedCount: removed,
      removalWhy: removalWhyForStage(def.id, ctx, removed, hasMeasuredPool),
      status,
    };
  });
}
