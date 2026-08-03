import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  buildBudgetSectionDataFromFacts,
  getCampaignFacts,
  resolveFactsCurrency,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { resolveCreatorIds } from "@/features/campaign-studio/services/section-data-resolver";
import { normalizeCreatorId } from "@/features/campaign-studio/services/studio-draft";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import {
  canonicalPlatformKey,
  getDeliverableTypeCodesForPlatform,
} from "@/lib/campaigns/deliverable-taxonomy";
import type { LinePlatformSelection } from "@/lib/campaigns/line-assignment";
import { computeCommercials } from "@/lib/commercial/commercial-engine";
import { DEFAULT_GP_TARGET_PCT } from "@/lib/domains/commercial/quotation-constants";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

export type CampaignPlanLineSeed = {
  /** Resolved influencer uuid — set by the service after promotion. */
  influencerId: string;
  unifiedId: string;
  displayName: string;
  platforms: LinePlatformSelection[];
  revenue: number;
  cost: number;
  /**
   * Target GP margin % when revenue was derived from creator fees (STAB-016).
   * Optional on quotation seeds where revenue/cost are already commercial facts.
   */
  gpPct?: number;
  currencyCode: string;
};

export type MapCampaignPlanExecutionInput = {
  campaignObject: CampaignObject;
  creators: UnifiedCreatorResult[];
  /** Influencer id keyed by normalized slate creator id. */
  influencerIdByCreatorId: Map<string, string>;
  contextText?: string;
};

const CREATOR_FEES_CATEGORY = /creator\s*fees?/i;

function readCreatorsData(campaignObject: CampaignObject): CreatorsSectionData {
  return (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
}

/** Slate creator ids approved for execution — excludes explicit rejections. */
export function filterExecutionCreatorIds(campaignObject: CampaignObject): string[] {
  const { ids } = resolveCreatorIds(campaignObject);
  const decisions = readCreatorsData(campaignObject).vendorDecisions ?? {};
  if (Object.keys(decisions).length === 0) return ids;

  return ids.filter((id) => {
    const decision = decisions[id] ?? decisions[normalizeCreatorId(id)];
    return decision !== "rejected";
  });
}

function resolveCreatorFeesTotal(
  campaignObject: CampaignObject,
  contextText: string
): number {
  const facts = getCampaignFacts(campaignObject);
  if (!facts?.budget?.amount) return 0;

  const budgetData = buildBudgetSectionDataFromFacts(facts, contextText);
  const creatorLine = budgetData.allocations.find((line) =>
    CREATOR_FEES_CATEGORY.test(line.category)
  );
  if (creatorLine?.amount != null && creatorLine.amount > 0) {
    return Math.round(creatorLine.amount);
  }

  return Math.round(facts.budget.amount);
}

function matchDeliverableCodes(
  platform: string,
  factsDeliverables: string[] | undefined
): string[] {
  const codes = getDeliverableTypeCodesForPlatform(platform);
  if (!codes.length) return ["other"];
  if (!factsDeliverables?.length) return [codes[0]];

  const platformKey = canonicalPlatformKey(platform);
  const haystack = factsDeliverables.map((d) => d.toLowerCase());

  for (const code of codes) {
    const tokens = code
      .split("_")
      .filter((t) => t.length > 2 && t !== platformKey);
    const hit = haystack.some((text) =>
      tokens.some((token) => text.includes(token.replace(/s$/, "")))
    );
    if (hit) return [code];
  }

  const platformMention = haystack.find((text) => text.includes(platformKey));
  if (platformMention) {
    if (/reel|short/.test(platformMention)) {
      const reel = codes.find((c) => c.includes("reel") || c.includes("short"));
      if (reel) return [reel];
    }
    if (/story/.test(platformMention)) {
      const story = codes.find((c) => c.includes("story"));
      if (story) return [story];
    }
    if (/post/.test(platformMention)) {
      const post = codes.find((c) => c.includes("post"));
      if (post) return [post];
    }
  }

  return [codes[0]];
}

function selectCreatorPlatforms(
  creator: UnifiedCreatorResult,
  campaignPlatforms: string[] | undefined
): UnifiedCreatorResult["platforms"] {
  const accounts = creator.platforms ?? [];
  if (!campaignPlatforms?.length) return accounts.length ? accounts : [];

  const wanted = new Set(campaignPlatforms.map(canonicalPlatformKey));
  const matched = accounts.filter((p) => wanted.has(canonicalPlatformKey(p.platform)));
  return matched.length > 0 ? matched : accounts;
}

export function buildPlatformSelectionsForCreator(
  creator: UnifiedCreatorResult,
  campaignPlatforms: string[] | undefined,
  factsDeliverables: string[] | undefined
): LinePlatformSelection[] {
  const platforms = selectCreatorPlatforms(creator, campaignPlatforms);
  return platforms
    .filter((p) => Boolean(p.id) && Boolean(p.handle))
    .map((p) => ({
      account_id: p.id,
      platform: canonicalPlatformKey(p.platform),
      handle: p.handle,
      profile_url: p.profile_url ?? null,
      follower_count: p.follower_count ?? 0,
      engagement_rate: p.engagement_rate ?? null,
      audience_country: p.audience_country ?? null,
      deliverables: matchDeliverableCodes(p.platform, factsDeliverables),
    }));
}

function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  if (total <= 0) return Array.from({ length: count }, () => 0);

  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

/**
 * Maps an approved Campaign Plan snapshot into campaign line seeds.
 * Finance estimates use the Creator Fees allocation split evenly across slate vendors.
 */
export function mapCampaignPlanToLineSeeds(
  input: MapCampaignPlanExecutionInput
): CampaignPlanLineSeed[] {
  const facts = getCampaignFacts(input.campaignObject);
  const contextText = input.contextText?.trim() || facts?.rawBriefExcerpt?.trim() || "";
  const currencyCode = facts ? resolveFactsCurrency(facts) : "USD";
  const approvedIds = new Set(
    filterExecutionCreatorIds(input.campaignObject).map(normalizeCreatorId)
  );

  const eligibleCreators = input.creators.filter((creator) =>
    approvedIds.has(normalizeCreatorId(creator.unified_id))
  );

  const creatorFeesTotal = resolveCreatorFeesTotal(input.campaignObject, contextText);
  const perCreatorAmounts = splitEvenly(creatorFeesTotal, eligibleCreators.length);

  return eligibleCreators.flatMap((creator, index) => {
    const influencerId = input.influencerIdByCreatorId.get(
      normalizeCreatorId(creator.unified_id)
    );
    if (!influencerId) return [];

    const platforms = buildPlatformSelectionsForCreator(
      creator,
      facts?.platforms,
      facts?.deliverables
    );
    if (platforms.length === 0) return [];

    const amount = perCreatorAmounts[index] ?? 0;
    // Creator fee allocation is cost. Apply default GP% so Generate does not
    // materialize zero-margin lines (STAB-016 / L'Oréal). Matches quotation mapper.
    const commercials = computeCommercials({
      mode: "cost_gp_pct",
      cost: amount,
      gpPct: DEFAULT_GP_TARGET_PCT,
    });
    return [
      {
        influencerId,
        unifiedId: creator.unified_id,
        displayName: creator.display_name,
        platforms,
        revenue: commercials.valid ? commercials.revenue : amount,
        cost: amount,
        gpPct: DEFAULT_GP_TARGET_PCT,
        currencyCode,
      },
    ];
  });
}

export function resolveCampaignNameFromPlan(campaignObject: CampaignObject): string {
  const facts = getCampaignFacts(campaignObject);
  const summary = campaignObject.sections.summary.content;
  const summaryName =
    typeof summary === "object" && summary && "campaignName" in summary
      ? String((summary as { campaignName?: string }).campaignName ?? "").trim()
      : "";

  return (
    summaryName ||
    facts?.product?.trim() ||
    facts?.brandName?.trim() ||
    "Campaign"
  );
}
