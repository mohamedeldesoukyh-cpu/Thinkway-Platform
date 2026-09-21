import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { mapCampaignIntelligenceToDiscoverySearch, discoveryMappedFiltersToCreatorFilters } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";
import { cloneCreatorSearchFilters, type CreatorSearchFilters } from "@/features/discovery/components/creator-search/creator-search-types";
import { evaluateNormalCandidate, type Candidate } from "./normal-search";

export type SelectionOwners = Partial<Record<keyof CreatorSearchFilters, "ai" | "manual">>;
const followerKeys = ["followerRanges", "minFollowers", "maxFollowers"] as const;
export function markManualChanges(previous: CreatorSearchFilters, next: CreatorSearchFilters, owners: SelectionOwners): SelectionOwners {
  const result = { ...owners };
  for (const key of Object.keys(next) as (keyof CreatorSearchFilters)[]) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) result[key] = "manual";
  }
  if (followerKeys.some(key => result[key] === "manual")) for (const key of followerKeys) result[key] = "manual";
  return result;
}
/** Manual removals are decisions too: an empty manual value must survive reruns. */
export function applyBriefSelections(profile: CampaignIntelligenceProfile, current: CreatorSearchFilters, owners: SelectionOwners) {
  const mapping = mapCampaignIntelligenceToDiscoverySearch(profile);
  const proposed = discoveryMappedFiltersToCreatorFilters(mapping.filters);
  const filters = cloneCreatorSearchFilters(current);
  const nextOwners = { ...owners };
  for (const key of Object.keys(filters) as (keyof CreatorSearchFilters)[]) {
    if (owners[key] === "manual") continue;
    Object.assign(filters, { [key]: proposed[key] });
    const value = proposed[key];
    if (Array.isArray(value) ? value.length : Boolean(value)) nextOwners[key] = "ai";
    else delete nextOwners[key];
  }
  return { filters, owners: nextOwners, requirements: mapping.requirements ?? [] };
}

export function briefRanking(profile: CampaignIntelligenceProfile, disabledSoftIds: string[] = []) {
  const requirements = mapCampaignIntelligenceToDiscoverySearch(profile).requirements ?? [];
  const soft = requirements.filter(r => r.classification === "SOFT" && !disabledSoftIds.includes(r.id) && !/premium|sophisticated|aspirational|youthful|authoritative|luxury|trendy|established/i.test(r.value));
  return {
    // Bound to the existing encrypted continuation's authenticated context, never a new token.
    binding: JSON.stringify({ requirements, disabledSoftIds: [...disabledSoftIds].sort() }),
    needsContent: soft.length > 0,
    evaluate(c: Candidate, filters: CreatorSearchFilters, now = Date.now()) {
      const base = evaluateNormalCandidate(c, filters, now);
      if (!base.eligible) return base;
      const scores = base.relevance.score == null ? [] : [base.relevance.score];
      for (const signal of soft) {
        // Same Phase 1 contextual text formula, applied only to stored evidence.
        // A topic is not an identity query: names/handles must not earn its exact-name bonus.
        // Soft evidence never gates eligibility or uses another query's retrieval rank.
        const topicCandidate = { ...c, display_name: "", platforms: c.platforms.map(p => ({ ...p, handle: "" })), search_rank: 0 };
        const evaluated = evaluateNormalCandidate(topicCandidate, { ...cloneCreatorSearchFilters(), search: signal.value }, now);
        if (evaluated.relevance.score != null) scores.push(evaluated.relevance.score);
        base.relevance.reasons.push({ dimension: signal.label, outcome: evaluated.relevance.score == null ? "Not available" : "Match", detail: signal.value });
      }
      for (const requirement of requirements.filter(r => r.classification === "UNSUPPORTED")) {
        base.relevance.reasons.push({ dimension: requirement.label, outcome: "Not available", detail: `${requirement.value} — not evaluated` });
      }
      base.relevance.score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return base;
    },
  };
}
