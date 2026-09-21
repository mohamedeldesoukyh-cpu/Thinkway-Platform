import { isClientIndustryCategory } from "@/features/campaign-studio/services/derive-creator-categories";
import type { CampaignIntelligenceProfile } from "../../types/profile";
import { getValidatedIntelligence } from "../get-validated-intelligence";
import { countryLabel } from "../normalization/validators";
import type { DiscoveryMappedFilter, DiscoveryRequirement, DiscoverySearchMappingResult, DiscoverySearchFilterKey } from "./types";

/** One mapping boundary for all CIP consumers. No market/audience proxies or inferred repair. */
export function mapCampaignIntelligenceToDiscoverySearch(profile: CampaignIntelligenceProfile): DiscoverySearchMappingResult {
  const v = getValidatedIntelligence(profile);
  const filters: DiscoveryMappedFilter[] = [];
  const requirements: DiscoveryRequirement[] = [];
  const add = (key: string, label: string, value: unknown, classification: DiscoveryRequirement["classification"], filterKey?: DiscoverySearchFilterKey) => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) return;
    const values = Array.isArray(value) ? value : [value];
    for (const raw of values) {
      const text = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      const id = `${key}:${text}`;
      if (requirements.some(r => r.id === id || (classification === "SOFT" && r.classification === "SOFT" && r.value.trim().toLowerCase() === text.trim().toLowerCase()))) continue;
      requirements.push({ id, key, label, value: text, classification, source: v?.fieldEvidence[key]?.excerpt });
      if (classification === "HARD" && filterKey) filters.push({ id, key: filterKey, label, value: text, weight: 100, confidence: 1 });
    }
  };
  if (v) {
    add("market.countryCode", "Campaign market", v.market.countryCode, "CONTEXT");
    add("audience.countries", "Audience geography", v.audience.countries, "UNSUPPORTED");
    add("audience.languages", "Audience language", v.audience.languages, "UNSUPPORTED");
    add("audience.gender", "Audience gender", v.audience.gender, "UNSUPPORTED");
    add("audience.ageMin", "Audience minimum age", v.audience.ageMin, "UNSUPPORTED");
    add("audience.ageMax", "Audience maximum age", v.audience.ageMax, "UNSUPPORTED");
    add("audience.cities", "Audience cities", v.audience.cities, "UNSUPPORTED");
    add("creator.countries", "Creator Country", v.creator.countries, "HARD", "creator_country");
    add("creator.languages", "Creator Language", v.creator.languages, "HARD", "language");
    add("creator.contentLanguages", "Content language", v.creator.contentLanguages, "UNSUPPORTED");
    add("creator.gender", "Creator gender", v.creator.gender, "UNSUPPORTED");
    add("creator.tiers", "Creator tier", v.creator.tiers, "HARD", "creator_tier");
    add("platforms", "Platform", v.platforms, "HARD", "platform");
    const categoryInferred = profile.fieldProvenance?.creatorCategories?.level === "inferred" || profile.sources?.creatorCategories === "inferred";
    add("categories", "Category", v.categories.filter(c => !isClientIndustryCategory(c)), categoryInferred ? "CONTEXT" : "HARD", "category");
    add("creator.followerMin", "Follower minimum", v.creator.followerMin, "HARD", "follower_min");
    add("creator.followerMax", "Follower maximum", v.creator.followerMax, "HARD", "follower_max");
    add("creator.engagementMin", "Engagement minimum", v.creator.engagementMin, "HARD", "engagement_min");
    const subjective = /premium|sophisticated|aspirational|youthful|authoritative|luxury|trendy|established/i;
    add("creator.niches", "Niche", v.creator.niches.filter(n => !subjective.test(n)), "SOFT");
    add("creator.niches", "Image preference", v.creator.niches.filter(n => subjective.test(n)), "UNSUPPORTED");
    // Retained products/brand copy and subjective image terms are not topical evidence.
    add("keywords", "Content topic", v.keywords.filter(k => !/premium|sophisticated|aspirational|youthful|authoritative|luxury|trendy|established/i.test(k) && (profile.fieldProvenance?.keywords?.level !== "inferred") && (profile.fieldProvenance?.keywords || v.fieldEvidence.keywords)), "SOFT");
    add("keywords", "Image preference", v.keywords.filter(k => subjective.test(k)), "UNSUPPORTED");
    add("brandSafety", "Brand safety", v.brandSafety === "none" ? null : v.brandSafety, "UNSUPPORTED");
  }
  for (const [key, label, value] of [
    ["brandName", "Brand", profile.brandName], ["clientName", "Client", profile.clientName],
    ["campaignName", "Campaign", profile.campaignName], ["objectives", "Objective", profile.objectives ?? profile.objective],
    ["budget", "Budget", profile.budget], ["durationWeeks", "Duration (weeks)", profile.durationWeeks],
    ["campaignStartDate", "Campaign start", profile.campaignStartDate], ["campaignEndDate", "Campaign end", profile.campaignEndDate],
    ["deliverables", "Content format / deliverables", profile.deliverables], ["kpis", "Campaign KPI", profile.kpis],
    ["products", "Products", profile.products], ["expectedCreatorCount", "Creator count", profile.expectedCreatorCount],
  ] as const) add(key, label, value, "CONTEXT");
  for (const [key, value] of Object.entries(profile.requirements ?? {})) add(`requirements.${key}`, key, value, "UNSUPPORTED");
  add("audience", "Audience requirements", profile.audience, "UNSUPPORTED");
  add("toneOfVoice", "Tone of voice", profile.toneOfVoice, "UNSUPPORTED");
  add("contentStyle", "Content style", profile.contentStyle, "UNSUPPORTED");
  add("marketTier", "Image preference", profile.marketTier, "UNSUPPORTED");
  add("constraints", "Other constraints", profile.constraints, "UNSUPPORTED");
  for (const fact of profile.campaignUnderstanding?.facts ?? []) {
    if (fact.status === "needs_classification" || fact.status === "conflicted") add(fact.id, "Needs review", fact.value, "UNSUPPORTED");
  }
  for (const issue of profile.extractionIssues ?? []) add(issue.field, "Needs review", issue.rawValue, "UNSUPPORTED");
  return { filters, requirements, skipped: v ? (profile.extractionIssues ?? []).map(i => `${i.field}:${i.rawValue}`) : ["no_validated_intelligence"] };
}

/** Display value for chips (e.g. country code → label). */
export function formatDiscoveryMappedFilterValue(filter: DiscoveryMappedFilter): string {
  if (filter.key === "audience_country" || filter.key === "creator_country") {
    return countryLabel(filter.value);
  }
  if (filter.key === "platform") {
    return filter.value.charAt(0).toUpperCase() + filter.value.slice(1);
  }
  if (filter.key === "audience_gender" || filter.key === "creator_gender") {
    return filter.value.charAt(0).toUpperCase() + filter.value.slice(1);
  }
  return filter.value;
}
