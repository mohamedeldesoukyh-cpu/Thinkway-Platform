import type {
  ContentPlanItem,
  CreativeConcept,
  StudioDraftState,
} from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { buildContentContext, type ContentContext } from "./content-context";
import {
  buildCreatorContentContext,
  deriveCreatorTreatment,
} from "./creator-content-context";
import {
  evidenceForCreator,
  type CreatorContentEvidenceByCreatorId,
} from "./creator-content-evidence";

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
  context: ContentContext,
  evidence?: CreatorContentEvidenceByCreatorId
): ContentPlanItem[];
/** @deprecated Live resolution and regeneration pass ContentContext explicitly. */
export function deriveInfluencerContentPlan(campaignObject: CampaignObject | undefined, draft?: StudioDraftState): ContentPlanItem[];
export function deriveInfluencerContentPlan(
  input: ContentContext | CampaignObject | undefined,
  draftOrEvidence?: StudioDraftState | CreatorContentEvidenceByCreatorId,
  maybeEvidence?: CreatorContentEvidenceByCreatorId
): ContentPlanItem[] {
  const context = input && "sections" in input
    ? buildContentContext({ campaignObject: input, draft: draftOrEvidence as StudioDraftState | undefined })
    : input;
  const evidence = input && "sections" in input
    ? maybeEvidence
    : (draftOrEvidence as CreatorContentEvidenceByCreatorId | undefined);
  if (!context) return [];
  if (context.readiness.status === "BLOCKED") return [];
  /**
   * The canonical slate — `recommendations.creatorIds` — minus the creators the
   * operator rejected.
   *
   * Content used to iterate `selectedReasoning` alone. That array had drifted
   * from `creatorIds` (see `creator-slate-integrity`), so a campaign whose
   * Creators screen and Campaign Analysis showed ten creators rendered six
   * here. Membership now comes from the ids, which is what the Creators header,
   * Campaign Analysis, the Package footer and execution all read; the reasoning
   * rows supply each creator's detail, and a member with no row carries an
   * identity-only one rather than disappearing.
   *
   * `approve_creator` / `reject_creator` do not change membership — they write
   * `vendorDecisions` — so the rejection filter stays, one rule for Content and
   * for commercial execution.
   */
  const creators = context.creators;
  if (creators.length === 0) return [];
  const concepts = context.strategy.creativeConcepts ?? [];
  const mix = context.strategy.creatorMix?.length ? context.strategy.creatorMix : [];
  const durationWeeks = context.durationWeeks ?? creators.length;
  const platforms = context.platforms.filter((item) => item.priority === "primary" || item.priority === "secondary").map((item) => item.platform);
  const objective = context.objective?.trim() || "Campaign objective";
  const contentStrategy = context.objective?.trim() ? `Creator content must advance ${context.objective.trim()} on ${platforms.join(" + ") || "confirmed platforms"}.` : undefined;

  const plan: Array<ContentPlanItem | null> = creators.flatMap((creator, index) => {
    const platform = creator.platform?.trim() || platforms[index % platforms.length];
    if (!platform) return [];
    const concept = conceptFor(concepts, undefined, index);
    const role =
      creator.creatorRole ||
      mix[index % Math.max(mix.length, 1)]?.tier ||
      "Creator";
    const week = (index % Math.max(1, durationWeeks)) + 1;
    const baseFormat = deliverableFor(platform, context.deliverables);
    const treatmentContext = buildCreatorContentContext({
      content: context,
      creator,
      evidence: evidenceForCreator(evidence, creator.creatorId),
    });
    const treatment = deriveCreatorTreatment(treatmentContext, {
      baseFormat,
      baseHook: concept?.hook || creator.whySelected,
      baseConcept: concept?.bigIdea || concept?.name || contentStrategy,
    });
    // Existing selected-reasoning service types are the canonical per-creator
    // deliverable signal. A plan is already an array, so each known service
    // type becomes one row without introducing a parallel deliverable model.
    const deliverables = creator.serviceTypes?.length
      ? creator.serviceTypes
      : [creator.serviceLabel || baseFormat];
    return deliverables.map((contentType, deliverableIndex) => ({
      platform,
      contentType,
      creatorTier: role,
      quantity: 1,
      postingDate: `Week ${week}`,
      objective,
      creatorId: creator.creatorId,
      // Every Content creator carries a defined status, so no row can read as
      // an approved campaign creator when it is only a proposal.
      creatorStatus: creator.status,
      creatorName: creator.creatorName,
      creatorRole: role,
      assignmentDeliverableId: creator.assignmentDeliverableId,
      assignmentPostScheduleId: creator.assignmentPostScheduleId,
      contentConcept: concept?.bigIdea || concept?.name || contentStrategy,
      hook: concept?.hook || creator.whySelected,
      keyMessage: concept?.contentTheme || concept?.keyVisual || context.keyMessages[0] || contentStrategy,
      // A confirmed CTA always wins. The legacy compatibility value is not
      // source-stated: it preserves existing readable campaigns that predate
      // Campaign Understanding while the context remains explicitly WARNING.
      cta: context.cta ?? concept?.cta ?? (context.legacyCompatibility ? "Learn more" : undefined),
      expectedKpi: kpiFor(context.kpis, role, index),
      strategyTrace: contentStrategy
        ? `Strategy: ${contentStrategy}`
        : "Strategy: confirm content strategy in Campaign Intelligence.",
      ...treatment,
      // Week assignment remains an explicit deterministic recommendation when
      // the canonical slate contains no creator-scoped phase/wave record.
      timingProvenance: "HEURISTIC_DEFAULT" as const,
      ...(deliverableIndex > 0 ? { postingDate: `Week ${week} · deliverable ${deliverableIndex + 1}` } : {}),
    }));
  });
  return plan.filter((item): item is ContentPlanItem => item !== null);
}
