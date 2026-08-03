import { brandMatchesAlias } from "../brand-resolution";
import type { CampaignIntelligenceProfile } from "../../types/profile";
import type { DiscoveryMappedFilter, DiscoverySearchMappingResult } from "./types";

function newFilterId(): string {
  return globalThis.crypto.randomUUID();
}

function hasFilter(
  filters: DiscoveryMappedFilter[],
  key: DiscoveryMappedFilter["key"],
  value: string
): boolean {
  const needle = value.trim().toLowerCase();
  return filters.some(
    (filter) => filter.key === key && filter.value.trim().toLowerCase() === needle
  );
}

function addFilter(
  filters: DiscoveryMappedFilter[],
  input: Omit<DiscoveryMappedFilter, "id" | "confidence"> & { confidence?: number }
): void {
  if (!input.value.trim()) return;
  if (hasFilter(filters, input.key, input.value)) return;
  filters.push({
    id: newFilterId(),
    confidence: input.confidence ?? 0.8,
    ...input,
  });
}

function collectBriefText(profile: CampaignIntelligenceProfile): string {
  return [
    profile.brandName,
    profile.clientName,
    profile.campaignName,
    profile.rawBriefExcerpt,
    profile.audience,
    profile.market,
    ...(profile.objectives ?? []),
    ...(profile.deliverables ?? []),
    ...(profile.products ?? []),
    ...(profile.creatorNiches ?? []),
    ...(profile.creatorCategories ?? []),
    ...(profile.requirements?.mandatory ?? []),
    ...(profile.requirements?.preferred ?? []),
    ...(profile.kpis ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function isTelecomOrYouthBrief(text: string, profile: CampaignIntelligenceProfile): boolean {
  const brand = profile.brandName ?? "";
  if (brandMatchesAlias("Etisalat", brand) || brandMatchesAlias("E&", brand)) {
    return true;
  }
  return /\b(etisalat|e&|eand|5g|telecom|telco|mobile network|gen\s*z|youth)\b/i.test(text);
}

/** Repair common PDF/Word encoding glitches in brand labels for UI. */
export function fixBrandDisplayName(value: string): string {
  return value
    .replace(/\uFFFD/g, "")
    .replace(/\bEsalat\b/gi, "Etisalat")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * When structured extraction is thin (country-only), infer business-relevant search
 * signals from brief text — platform, youth audience, telecom/tech keywords.
 */
export function enrichBriefSearchSignals(
  profile: CampaignIntelligenceProfile,
  result: DiscoverySearchMappingResult
): DiscoverySearchMappingResult {
  const text = collectBriefText(profile);
  const filters = [...result.filters];

  const wantsTikTok = /\btiktok\b/i.test(text);
  const wantsInstagram = /\binstagram\b|\big\b/i.test(text);
  const wantsYouTube = /\byoutube\b/i.test(text);
  const youthBrief =
    /\b(gen\s*z|gen-z|youth|young adult|18\s*[-–]\s*24|18\s*[-–]\s*34|students?)\b/i.test(
      text
    ) || isTelecomOrYouthBrief(text, profile);

  if (wantsTikTok && !hasFilter(filters, "platform", "tiktok")) {
    addFilter(filters, {
      key: "platform",
      label: "Social Platform",
      value: "tiktok",
      weight: 100,
    });
  } else if (wantsYouTube && !hasFilter(filters, "platform", "youtube")) {
    addFilter(filters, {
      key: "platform",
      label: "Social Platform",
      value: "youtube",
      weight: 95,
    });
  } else if (wantsInstagram && !hasFilter(filters, "platform", "instagram")) {
    addFilter(filters, {
      key: "platform",
      label: "Social Platform",
      value: "instagram",
      weight: 90,
    });
  }

  if (youthBrief) {
    if (!hasFilter(filters, "audience_age_min", "18")) {
      addFilter(filters, {
        key: "audience_age_min",
        label: "Audience Age Min",
        value: "18",
        weight: 90,
      });
    }
    if (!hasFilter(filters, "audience_age_max", "24")) {
      addFilter(filters, {
        key: "audience_age_max",
        label: "Audience Age Max",
        value: "24",
        weight: 90,
      });
    }
  }

  const keywordCandidates: Array<{ value: string; weight: number }> = [];
  if (isTelecomOrYouthBrief(text, profile)) {
    keywordCandidates.push(
      { value: "5G", weight: 95 },
      { value: "technology", weight: 90 },
      { value: "telecom", weight: 90 },
      { value: "gaming", weight: 85 },
      { value: "lifestyle", weight: 80 },
      { value: "entertainment", weight: 80 },
      { value: "Gen Z", weight: 85 }
    );
    if (!filters.some((f) => f.key === "category")) {
      addFilter(filters, {
        key: "category",
        label: "Category",
        value: "Technology",
        weight: 85,
      });
      addFilter(filters, {
        key: "category",
        label: "Category",
        value: "Entertainment",
        weight: 80,
      });
    }
    if (!wantsTikTok && !wantsInstagram && !wantsYouTube && !filters.some((f) => f.key === "platform")) {
      addFilter(filters, {
        key: "platform",
        label: "Social Platform",
        value: "tiktok",
        weight: 95,
        confidence: 0.75,
      });
    }
  }

  // Category signals from thin briefs (preferred — never mandatory). Without this,
  // unmatched-brand CIP maps often ship platform+country only and every Egypt
  // campaign collapses to the same lifestyle slate.
  if (!filters.some((f) => f.key === "category")) {
    if (/\b(beauty|skincare|makeup|cosmetics|dermatolog)\b/i.test(text)) {
      addFilter(filters, {
        key: "category",
        label: "Category",
        value: "Beauty",
        weight: 88,
        confidence: 0.82,
      });
      keywordCandidates.push(
        { value: "skincare", weight: 80 },
        { value: "beauty", weight: 78 }
      );
    } else if (/\b(fashion|apparel|clothing|streetwear)\b/i.test(text)) {
      addFilter(filters, {
        key: "category",
        label: "Category",
        value: "Fashion",
        weight: 88,
        confidence: 0.82,
      });
    } else if (/\b(retail|e-?commerce|shopping|marketplace)\b/i.test(text)) {
      addFilter(filters, {
        key: "category",
        label: "Category",
        value: "Lifestyle",
        weight: 82,
        confidence: 0.78,
      });
      keywordCandidates.push(
        { value: "shopping", weight: 78 },
        { value: "retail", weight: 76 }
      );
    } else if (/\b(formula\s*1|f1|motorsport|racing|grand prix)\b/i.test(text)) {
      addFilter(filters, {
        key: "category",
        label: "Category",
        value: "Sports",
        weight: 88,
        confidence: 0.82,
      });
      keywordCandidates.push({ value: "motorsport", weight: 80 });
    } else if (/\b(festival|liwa|cultural|heritage|tourism)\b/i.test(text)) {
      addFilter(filters, {
        key: "category",
        label: "Category",
        value: "Travel",
        weight: 82,
        confidence: 0.78,
      });
      keywordCandidates.push({ value: "festival", weight: 78 });
    }
  }

  const explicitKeywords = text.match(
    /\b(5g|gaming|tech|technology|telecom|mobile|esports|lifestyle|entertainment|comedy|music|skincare|beauty|fashion|retail|shopping)\b/gi
  );
  for (const match of explicitKeywords ?? []) {
    keywordCandidates.push({ value: match, weight: 75 });
  }

  for (const { value, weight } of keywordCandidates) {
    if (!hasFilter(filters, "content_keyword", value)) {
      addFilter(filters, {
        key: "content_keyword",
        label: "Keyword",
        value,
        weight,
      });
    }
  }

  return { filters, skipped: result.skipped };
}
