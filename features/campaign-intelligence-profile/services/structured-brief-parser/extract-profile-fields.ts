import { parseOptionalDurationWeeks } from "@/features/campaign-studio/services/timeline-duration";

import {
  parseFollowerRange,
  parseEngagementPercent,
} from "../normalization/validators";
import {
  createEmptyCampaignIntelligenceProfile,
  setProfileFieldMeta,
  type CampaignIntelligenceProfile,
} from "../../types/profile";
import type { StructuredBriefDocument } from "./types";

const STRUCTURED_CONFIDENCE = 0.95;

function collectKeyValueRows(document: StructuredBriefDocument): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.type !== "table") continue;
      for (const row of block.rows) {
        const label = row[0]?.trim();
        const value = row
          .slice(1)
          .map((cell) => cell?.trim())
          .filter(Boolean)
          .join(", ")
          .trim();
        if (label && value) rows.push([label, value]);
      }
    }
  }
  return rows;
}

function labelMatches(label: string, patterns: RegExp[]): boolean {
  const normalized = label.trim();
  return patterns.some((pattern) => pattern.test(normalized));
}

function splitList(value: string): string[] {
  return value
    .split(/\s*(?:,|;|\|)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Split platform lists including "Instagram & TikTok". */
function splitPlatforms(value: string): string[] {
  const platforms: string[] = [];
  const parts = value
    .split(/\s*(?:,|;|\||&|\/|\+|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.includes("instagram")) platforms.push("instagram");
    if (lower.includes("tiktok")) platforms.push("tiktok");
    if (lower.includes("youtube")) platforms.push("youtube");
    if (lower.includes("twitter") || lower === "x") platforms.push("twitter");
  }

  return [...new Set(platforms)];
}

function parseFollowerBounds(value: string): { min?: number; max?: number } {
  const fromRange = parseFollowerRange(value);
  if (fromRange) return fromRange;

  const match = value.match(
    /(\d[\d,.\s]*)\s*([kKmM])?\s*(?:-|–|—|to)\s*(\d[\d,.\s]*)\s*([kKmM])?/i
  );
  if (!match) return {};

  const toCount = (raw: string, suffix?: string) => {
    const num = Number(raw.replace(/,/g, "").trim());
    if (!Number.isFinite(num)) return undefined;
    const s = suffix?.toLowerCase();
    if (s === "k") return Math.round(num * 1_000);
    if (s === "m") return Math.round(num * 1_000_000);
    return Math.round(num);
  };

  return {
    min: toCount(match[1]!, match[2]),
    max: toCount(match[3]!, match[4]),
  };
}

function parseAudienceAge(value: string): { min?: number; max?: number } {
  const range = value.match(/(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})/);
  if (!range) return {};
  return { min: Number(range[1]), max: Number(range[2]) };
}

function parseAudienceGender(value: string): string | undefined {
  if (/\b(female|women|woman)\b/i.test(value)) return "female";
  if (/\b(male|men|man)\b/i.test(value)) return "male";
  return undefined;
}

/** Map structured parser table rows to CIP profile fields (deterministic KV briefs). */
export function extractProfileFieldsFromStructuredBrief(
  document: StructuredBriefDocument
): Partial<CampaignIntelligenceProfile> {
  const patch: Partial<CampaignIntelligenceProfile> = {};
  const keywords: string[] = [];
  const contentStyle: string[] = [];
  const platforms: string[] = [];
  const objectives: string[] = [];
  const deliverables: string[] = [];
  const kpis: string[] = [];
  const creatorNiches: string[] = [];
  const creatorCategories: string[] = [];
  let followerMin: number | undefined;
  let followerMax: number | undefined;

  for (const [label, value] of collectKeyValueRows(document)) {
    if (labelMatches(label, [/^campaign$/i]) && !/name/i.test(label)) {
      patch.campaignName = value;
      continue;
    }

    if (
      labelMatches(label, [
        /^client\s*\/\s*brand\s*name$/i,
        /^brand\s*name$/i,
        /^brand$/i,
        /^client$/i,
      ])
    ) {
      patch.brandName = value;
      continue;
    }

    if (labelMatches(label, [/^market$/i, /^primary\s*market$/i, /^location$/i])) {
      patch.market = value;
      patch.geography = [...new Set([...(patch.geography ?? []), value])];
      continue;
    }

    if (labelMatches(label, [/^campaign\s*country$/i])) {
      patch.geography = [...new Set([...(patch.geography ?? []), value])];
      if (!patch.market) patch.market = value;
      continue;
    }

    if (labelMatches(label, [/^campaign\s*name$/i])) {
      patch.campaignName = value;
      continue;
    }

    if (labelMatches(label, [/^campaign\s*duration$/i, /^duration$/i])) {
      const weeks = parseOptionalDurationWeeks(value);
      if (weeks != null) patch.durationWeeks = weeks;
      continue;
    }

    if (labelMatches(label, [/^gender$/i])) {
      const gender = parseAudienceGender(value);
      if (gender) {
        patch.audienceDetail = { ...(patch.audienceDetail ?? {}), gender };
      }
      continue;
    }

    if (labelMatches(label, [/^age$/i])) {
      const ages = parseAudienceAge(value);
      if (ages.min != null || ages.max != null) {
        patch.audienceDetail = {
          ...(patch.audienceDetail ?? {}),
          ageMin: ages.min ?? patch.audienceDetail?.ageMin,
          ageMax: ages.max ?? patch.audienceDetail?.ageMax,
        };
      }
      continue;
    }

    if (labelMatches(label, [/^interests$/i])) {
      keywords.push(...splitList(value));
      continue;
    }

    if (labelMatches(label, [/^categories$/i])) {
      creatorCategories.push(...splitList(value));
      continue;
    }

    if (labelMatches(label, [/^followers?$/i, /^follower\s*range$/i])) {
      const bounds = parseFollowerBounds(value);
      followerMin = bounds.min ?? followerMin;
      followerMax = bounds.max ?? followerMax;
      continue;
    }

    if (labelMatches(label, [/^minimum\s*engagement\s*rate$/i])) {
      const rate = parseEngagementPercent(value);
      if (rate != null) {
        kpis.push(`Engagement rate ${rate}%`);
      }
      continue;
    }

    if (labelMatches(label, [/^content$/i])) {
      contentStyle.push(...splitList(value));
      keywords.push(...splitList(value));
      continue;
    }

    if (labelMatches(label, [/^campaign\s*objectives?$/i, /^objectives?$/i])) {
      objectives.push(...splitList(value));
      continue;
    }

    if (labelMatches(label, [/^social\s*platforms?$/i, /^platforms?$/i])) {
      platforms.push(...splitPlatforms(value));
      continue;
    }

    if (
      labelMatches(label, [
        /^creator\s*type\s*preferences?$/i,
        /^creator\s*types?$/i,
        /^creator\s*preferences?$/i,
      ])
    ) {
      creatorNiches.push(...splitList(value));
      const bounds = parseFollowerBounds(value);
      followerMin = bounds.min ?? followerMin;
      followerMax = bounds.max ?? followerMax;
      continue;
    }

    if (labelMatches(label, [/^audience\s*preferences?$/i, /^target\s*audience$/i, /^audience$/i])) {
      patch.audience = value;
      const gender = parseAudienceGender(value);
      const ages = parseAudienceAge(value);
      if (gender || ages.min != null || ages.max != null) {
        patch.audienceDetail = {
          ...(patch.audienceDetail ?? {}),
          gender: gender ?? patch.audienceDetail?.gender,
          ageMin: ages.min ?? patch.audienceDetail?.ageMin,
          ageMax: ages.max ?? patch.audienceDetail?.ageMax,
        };
      }
      continue;
    }

    if (labelMatches(label, [/^content\s*keywords?$/i, /^keywords?$/i])) {
      keywords.push(...splitList(value));
      continue;
    }

    if (labelMatches(label, [/^deliverables?$/i])) {
      deliverables.push(...splitList(value));
      continue;
    }

    if (labelMatches(label, [/^kpis?$/i, /^kpi\s*targets?$/i])) {
      kpis.push(...splitList(value));
      continue;
    }

    if (labelMatches(label, [/^budget$/i])) {
      const amountMatch = value.match(/([\d,]+(?:\.\d+)?)/);
      const currencyMatch = value.match(/\b([A-Z]{3})\b/);
      if (amountMatch) {
        patch.budget = {
          amount: Number(amountMatch[1]!.replace(/,/g, "")),
          currency: currencyMatch?.[1] ?? "USD",
        };
      }
    }
  }

  if (objectives.length) patch.objectives = [...new Set(objectives)];
  if (platforms.length) patch.platforms = [...new Set(platforms)];
  if (keywords.length) patch.products = [...new Set(keywords)];
  if (contentStyle.length) patch.contentStyle = [...new Set(contentStyle)];
  if (deliverables.length) patch.deliverables = [...new Set(deliverables)];
  if (kpis.length) patch.kpis = [...new Set(kpis)];
  if (creatorNiches.length) {
    patch.creatorNiches = [...new Set(creatorNiches)];
    for (const niche of creatorNiches) {
      if (!/follower/i.test(niche)) creatorCategories.push(niche);
    }
  }
  if (creatorCategories.length) {
    patch.creatorCategories = [...new Set(creatorCategories)];
  }
  if (followerMin != null || followerMax != null) {
    const label =
      followerMin != null && followerMax != null
        ? `${followerMin}-${followerMax} followers`
        : followerMin != null
          ? `${followerMin}+ followers`
          : `up to ${followerMax} followers`;
    patch.creatorCategories = [...new Set([...(patch.creatorCategories ?? []), label])];
  }

  return patch;
}

/** Apply structured parser KV rows onto an extracted profile (structured rows win). */
export function applyStructuredBriefFields(
  profile: CampaignIntelligenceProfile,
  document?: StructuredBriefDocument
): CampaignIntelligenceProfile {
  if (!document) return profile;

  const patch = extractProfileFieldsFromStructuredBrief(document);
  if (Object.keys(patch).length === 0) return profile;

  const next: CampaignIntelligenceProfile = {
    ...createEmptyCampaignIntelligenceProfile(),
    ...profile,
    ...patch,
    geography: patch.geography ?? profile.geography,
    objectives: patch.objectives ?? profile.objectives,
    platforms: patch.platforms ?? profile.platforms,
    products: patch.products ?? profile.products,
    deliverables: patch.deliverables ?? profile.deliverables,
    kpis: patch.kpis ?? profile.kpis,
    creatorCategories: patch.creatorCategories ?? profile.creatorCategories,
    creatorNiches: patch.creatorNiches ?? profile.creatorNiches,
    contentStyle: patch.contentStyle ?? profile.contentStyle,
    audienceDetail: {
      ...profile.audienceDetail,
      ...patch.audienceDetail,
      countries: patch.audienceDetail?.countries ?? profile.audienceDetail?.countries,
      cities: patch.audienceDetail?.cities ?? profile.audienceDetail?.cities,
      languages: patch.audienceDetail?.languages ?? profile.audienceDetail?.languages,
    },
    confidence: { ...profile.confidence },
    sources: { ...profile.sources },
  };

  const structuredFields = [
    "brandName",
    "clientName",
    "campaignName",
    "market",
    "geography",
    "objective",
    "objectives",
    "audience",
    "platforms",
    "budget",
    "durationWeeks",
    "deliverables",
    "kpis",
    "creatorCategories",
    "creatorNiches",
    "products",
    "contentStyle",
  ] as const;

  for (const field of structuredFields) {
    if (patch[field] == null) continue;
    setProfileFieldMeta(next, field, "brief", STRUCTURED_CONFIDENCE);
  }

  if (patch.audienceDetail?.gender || patch.audienceDetail?.ageMin != null || patch.audienceDetail?.ageMax != null) {
    setProfileFieldMeta(next, "audience", "brief", STRUCTURED_CONFIDENCE);
  }

  return next;
}
