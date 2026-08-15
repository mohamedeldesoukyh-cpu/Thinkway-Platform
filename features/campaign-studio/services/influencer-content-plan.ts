import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  ContentPlanItem,
  CreativeConcept,
  CreatorsSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts, buildCreatorMixFromFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { resolveCampaignDurationWeeks } from "./timeline-duration";

const PLATFORM_DELIVERABLE: Record<string, string> = {
  instagram: "Reel",
  tiktok: "Short video",
  youtube: "Integration / Short",
  facebook: "Reel",
  snapchat: "Story",
  twitter: "Native video",
  x: "Native video",
};

function platformKey(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function deliverableFor(platform: string, factsDeliverables: string[]): string {
  const match = factsDeliverables.find((item) =>
    item.toLowerCase().includes(platformKey(platform))
  );
  if (match) return match;
  return PLATFORM_DELIVERABLE[platformKey(platform)] ?? "Creator deliverable";
}

function conceptFor(
  concepts: CreativeConcept[],
  contentPillar: string | undefined,
  index: number
): CreativeConcept | undefined {
  if (concepts.length === 0) return undefined;
  if (contentPillar) {
    const hit = concepts.find((concept) =>
      `${concept.name} ${concept.contentTheme} ${concept.bigIdea}`
        .toLowerCase()
        .includes(contentPillar.toLowerCase())
    );
    if (hit) return hit;
  }
  return concepts[index % concepts.length];
}

function kpiFor(factsKpis: string[], role: string, index: number): string {
  if (factsKpis.length > 0) return factsKpis[index % factsKpis.length]!;
  if (/macro|celebrity|mega/i.test(role)) return "Reach / branded awareness";
  if (/micro|nano/i.test(role)) return "Engagement / qualified consideration";
  return "Delivery against campaign KPIs";
}

/**
 * Per-creator influencer content plan from Strategy + recommended slate.
 * Generic industry templates are not used when a slate exists.
 */
export function deriveInfluencerContentPlan(
  campaignObject: CampaignObject | undefined
): ContentPlanItem[] {
  if (!campaignObject) return [];
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const slateById = new Map(
    (creatorsData.slateIntelligence?.recommendations ?? []).map((row) => [row.creatorId, row])
  );
  const reasoning = (creatorsData.recommendations?.selectedReasoning ?? []).filter(
    (entry) => entry.creatorId?.trim()
  );
  if (reasoning.length === 0) return [];

  const facts = getCampaignFacts(campaignObject);
  const strategyText =
    typeof campaignObject.sections.strategy.content === "string"
      ? campaignObject.sections.strategy.content.trim()
      : "";
  const contentStrategy = facts?.objective?.trim()
    ? `Creator content must advance ${facts.objective.trim()} on ${(facts.platforms ?? []).join(" + ") || "priority platforms"}.`
    : strategyText.slice(0, 280);
  const strategyData = (campaignObject.sections.strategy.data ?? {}) as {
    creativeConcepts?: CreativeConcept[];
    creatorMix?: Array<{ tier: string }>;
  };
  const concepts = strategyData.creativeConcepts ?? [];
  const mix = strategyData.creatorMix?.length
    ? strategyData.creatorMix
    : facts
      ? buildCreatorMixFromFacts(facts)
      : [];
  const durationWeeks =
    facts?.durationWeeks ??
    resolveCampaignDurationWeeks(
      typeof campaignObject.sections.summary.content === "string"
        ? campaignObject.sections.summary.content
        : "",
      typeof campaignObject.sections.strategy.content === "string"
        ? campaignObject.sections.strategy.content
        : ""
    ) ??
    reasoning.length;
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const objective = facts?.objective?.trim() || "Campaign objective";
  const deliverables = facts?.deliverables ?? [];
  const kpis = facts?.kpis ?? [];

  return reasoning.map((entry, index) => {
    const platform = entry.platform?.trim() || platforms[index % platforms.length]!;
    const slate = slateById.get(entry.creatorId);
    const concept = conceptFor(concepts, slate?.contentPillar, index);
    const role =
      entry.expectedRole?.trim() ||
      slate?.role ||
      mix[index % Math.max(mix.length, 1)]?.tier ||
      "Creator";
    const week = (index % Math.max(1, durationWeeks)) + 1;
    return {
      platform,
      contentType: deliverableFor(platform, deliverables),
      creatorTier: role,
      quantity: 1,
      postingDate: `Week ${week}`,
      objective,
      creatorId: entry.creatorId,
      creatorName: entry.displayName?.trim() || entry.handle || entry.creatorId,
      creatorRole: role,
      contentConcept: concept?.bigIdea || slate?.contentPillar || concept?.name || contentStrategy,
      hook: concept?.hook || entry.whySelected,
      keyMessage: concept?.contentTheme || concept?.keyVisual || contentStrategy,
      cta: concept?.cta || "Drive the campaign action from this creator’s audience.",
      expectedKpi: kpiFor(kpis, role, index),
      strategyTrace: contentStrategy
        ? `Strategy: ${contentStrategy}`
        : "Strategy: confirm content strategy in Campaign Intelligence.",
    };
  });
}
