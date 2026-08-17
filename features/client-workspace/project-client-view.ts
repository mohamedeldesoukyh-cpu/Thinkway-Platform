import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  TimelineSectionData,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { deriveInfluencerContentPlan } from "@/features/campaign-studio/services/influencer-content-plan";
import { deriveEnterprisePlanningNarrative } from "@/features/campaign-studio/services/planning-narrative";
import { resolveBudgetData, resolveTimelineData } from "@/features/campaign-studio/services/section-data-resolver";
import { resolveStudioPackageReadiness } from "@/features/campaign-studio/services/studio-package-readiness";
import { formatMoneyKpi } from "@/lib/finance/currency-format";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import { clientFacingAllocationNote, clientSafeFitCopy } from "./format";
import type { ClientCreatorSelectionState } from "./constants";
import type {
  ClientCommercialLine,
  ClientCommercialSummary,
  ClientContentRow,
  ClientCreatorCard,
  ClientOverview,
  ClientTimelinePhase,
} from "./types";

function creatorsData(campaignObject: CampaignObject): CreatorsSectionData {
  return (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
}

export function clientCreatorIds(campaignObject: CampaignObject): string[] {
  const data = creatorsData(campaignObject);
  const ids = data.recommendations?.creatorIds ?? [];
  return ids.filter((id) => Boolean(id?.trim()));
}

function reasoningById(campaignObject: CampaignObject): Map<string, VendorSelectedReasoning> {
  const rows = creatorsData(campaignObject).recommendations?.selectedReasoning ?? [];
  return new Map(rows.filter((row) => row.creatorId?.trim()).map((row) => [row.creatorId, row]));
}

function hydratedById(creators: UnifiedCreatorResult[]): Map<string, UnifiedCreatorResult> {
  const map = new Map<string, UnifiedCreatorResult>();
  for (const creator of creators) {
    map.set(creator.unified_id, creator);
    if (creator.influencer_id) {
      map.set(creator.influencer_id, creator);
      map.set(`inf:${creator.influencer_id}`, creator);
    }
    if (creator.discovered_profile_id) {
      map.set(creator.discovered_profile_id, creator);
      map.set(`dis:${creator.discovered_profile_id}`, creator);
    }
  }
  return map;
}

function primaryPlatform(creator?: UnifiedCreatorResult, reasoning?: VendorSelectedReasoning) {
  if (reasoning?.platform) return reasoning.platform;
  return creator?.platforms[0]?.platform;
}

function primaryHandle(creator?: UnifiedCreatorResult, reasoning?: VendorSelectedReasoning) {
  if (reasoning?.handle) return reasoning.handle;
  const handle = creator?.platforms[0]?.handle;
  return handle ? (handle.startsWith("@") ? handle : `@${handle}`) : undefined;
}

export function projectClientCommercial(
  campaignObject: CampaignObject,
  selection: Record<string, ClientCreatorSelectionState>
): ClientCommercialSummary {
  const facts = getCampaignFacts(campaignObject);
  const budget = resolveBudgetData(campaignObject);
  const currency = (budget?.currency || facts?.budget?.currency || "EGP").trim() || "EGP";
  const ids = clientCreatorIds(campaignObject);
  const selectedIds = ids.filter((id) => (selection[id] ?? "in_review") !== "rejected");
  const selectedRatio = ids.length === 0 ? 1 : selectedIds.length / ids.length;
  const total = facts?.budget?.amount ?? budget?.total ?? 0;
  const creatorInvestment = Math.round(total * selectedRatio);
  const lines: ClientCommercialLine[] = (budget?.allocations ?? [])
    .filter((line) => !/margin|gp|cost|internal/i.test(line.category))
    .map((line) => ({
      label: line.category,
      amount:
        line.amount != null ? Math.round(line.amount * selectedRatio) : undefined,
      note: clientFacingAllocationNote(line.notes),
    }));
  if (lines.length === 0 && creatorInvestment > 0) {
    lines.push({ label: "Creator investment", amount: creatorInvestment });
  }
  return {
    currency,
    creatorInvestment,
    totalInvestment: creatorInvestment,
    lines,
    selectedCount: selectedIds.length,
    totalCount: ids.length,
  };
}

export function projectClientCreators(
  campaignObject: CampaignObject,
  selection: Record<string, ClientCreatorSelectionState>,
  hydrated: UnifiedCreatorResult[] = []
): ClientCreatorCard[] {
  const ids = clientCreatorIds(campaignObject);
  const reasoning = reasoningById(campaignObject);
  const hydratedMap = hydratedById(hydrated);
  return ids.map((creatorId) => {
    const row = reasoning.get(creatorId);
    const profile = hydratedMap.get(creatorId);
    const platform = primaryPlatform(profile, row);
    const followers =
      profile?.metrics.followers.value ??
      profile?.platforms[0]?.follower_count ??
      undefined;
    const engagement =
      profile?.metrics.engagement_rate.value ??
      profile?.platforms[0]?.engagement_rate ??
      undefined;
    const examples = (profile?.platforms[0]?.recent_publications ?? [])
      .slice(0, 3)
      .map((pub) => ({
        url: pub.url,
        thumbnail: pub.thumbnail,
        likes: pub.likes,
      }));
    return {
      creatorId,
      displayName: row?.displayName?.trim() || profile?.display_name || "Creator",
      handle: primaryHandle(profile, row),
      platform,
      followers: followers ?? undefined,
      engagementRate: engagement ?? undefined,
      country: profile?.estimated_country || profile?.country_code || undefined,
      city: profile?.city || undefined,
      category: profile?.categories[0] || profile?.ai_category || undefined,
      audienceHighlight: profile?.audience_interests?.slice(0, 3).join(" · ") || undefined,
      fitExplanation: clientSafeFitCopy(row?.audienceMatch || row?.whySelected),
      deliverables: row?.serviceLabel,
      investmentAmount: row?.quotedRevenue,
      investmentCurrency: row?.quotedCurrency,
      avatarUrl: row?.avatarUrl || profile?.primaryAvatarUrl || profile?.profile_image_url || undefined,
      bio: profile?.bio || undefined,
      selection: selection[creatorId] ?? "in_review",
      contentExamples: examples,
    };
  });
}

export function projectClientContent(campaignObject: CampaignObject): ClientContentRow[] {
  return deriveInfluencerContentPlan(campaignObject).map((item) => ({
    creatorId: item.creatorId,
    creatorName: item.creatorName || item.creatorRole || "Creator",
    platform: item.platform,
    deliverable: item.contentType,
    contentConcept: item.contentConcept,
    keyMessage: item.keyMessage,
    hook: item.hook,
    cta: item.cta,
    timing: item.postingDate,
  }));
}

export function projectClientTimeline(campaignObject: CampaignObject): {
  durationWeeks: number | null;
  durationLabel: string;
  phases: ClientTimelinePhase[];
} {
  const facts = getCampaignFacts(campaignObject);
  const timeline = resolveTimelineData(campaignObject) as TimelineSectionData | undefined;
  const weeks = facts?.durationWeeks ?? timeline?.durationWeeks ?? null;
  const phases: ClientTimelinePhase[] = (timeline?.milestones ?? []).map((milestone) => ({
    week: milestone.week,
    label: milestone.phase,
    activities: milestone.activities ?? [],
  }));
  if (phases.length === 0 && weeks && weeks > 0) {
    for (let week = 1; week <= weeks; week += 1) {
      phases.push({
        week,
        label: week === 1 ? "Preparation" : week === weeks ? "Final activation" : "Creator content",
        activities: [],
      });
    }
  }
  return {
    durationWeeks: weeks,
    durationLabel: weeks ? `${weeks} week${weeks === 1 ? "" : "s"}` : "Duration not confirmed",
    phases,
  };
}

export function projectClientOverview(
  campaignObject: CampaignObject,
  selection: Record<string, ClientCreatorSelectionState>
): ClientOverview {
  const facts = getCampaignFacts(campaignObject);
  const narrative = deriveEnterprisePlanningNarrative(campaignObject);
  const commercial = projectClientCommercial(campaignObject, selection);
  const why = [narrative.recommendedBusinessDecision, narrative.campaignStrategy]
    .filter((part) => part && !/^insufficient/i.test(part))
    .join(" ");
  return {
    brandName: facts?.brandName?.trim() || "Brand",
    campaignName: facts?.product?.trim() || facts?.objective?.trim() || "Campaign",
    clientLabel: facts?.clientName?.trim() || facts?.brandName?.trim() || "Client",
    objective: facts?.objective?.trim(),
    audience: facts?.audience?.trim(),
    market: facts?.geography?.join(", "),
    durationLabel: facts?.durationWeeks
      ? `${facts.durationWeeks} week${facts.durationWeeks === 1 ? "" : "s"}`
      : undefined,
    platforms: facts?.platforms ?? [],
    deliverables: facts?.deliverables ?? [],
    creatorCount: clientCreatorIds(campaignObject).length,
    whyThisApproach: why.slice(0, 480) || "Thinkway recommends this creator-led approach based on the confirmed campaign facts.",
    commercial,
  };
}

export function packageFingerprintFromObject(campaignObject: CampaignObject) {
  return resolveStudioPackageReadiness(campaignObject).sourceState;
}

export function clientPackageFingerprintsMatch(
  frozen: { budgetAmount?: number; durationWeeks?: number; creatorIds?: string[] } | Record<string, unknown>,
  live: { budgetAmount?: number; durationWeeks?: number; creatorIds: string[] }
): boolean {
  const frozenIds = Array.isArray((frozen as { creatorIds?: string[] }).creatorIds)
    ? (frozen as { creatorIds: string[] }).creatorIds.join("|")
    : "";
  return (
    (frozen as { budgetAmount?: number }).budgetAmount === live.budgetAmount &&
    (frozen as { durationWeeks?: number }).durationWeeks === live.durationWeeks &&
    frozenIds === live.creatorIds.join("|")
  );
}

export function formatClientInvestment(summary: ClientCommercialSummary): string {
  return formatMoneyKpi(summary.totalInvestment, summary.currency);
}
