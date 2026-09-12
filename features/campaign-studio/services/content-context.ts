import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData, StudioDraftState } from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { buildStrategyContext } from "@/features/campaign-intelligence-profile/services/campaign-understanding/build-strategy-context";
import type { CampaignUnderstanding, SemanticFact } from "@/features/campaign-intelligence-profile/types/campaign-understanding";
import { evaluateCampaignUnderstandingQualityGate } from "@/features/campaign-intelligence-profile/services/campaign-understanding/quality-gate";
import { resolveStrategyBasisStatus, type StrategyBasisStatus } from "@/features/campaign-director/services/strategy-basis";

import { creatorDecisionStatus, isCreatorRejected } from "./creator-decision-status";
import { reconcileCreatorSlateReasoning } from "./creator-slate-integrity";
import { previewCreatorsSectionFromDraft } from "./studio-draft-preview";
import { creatorGroupingKey } from "./studio-creator-slate-split";

export type ContentReadinessStatus = "READY" | "WARNING" | "BLOCKED";

export type ContentContextCreator = {
  creatorId: string;
  creatorName: string;
  creatorRole?: string;
  platform?: string;
  whySelected?: string;
  status: ReturnType<typeof creatorDecisionStatus>;
};

export type ContentContext = {
  campaignUnderstanding?: {
    schemaVersion: number;
    confirmationStatus: CampaignUnderstanding["confirmation"]["status"];
    confirmedFactIds: string[];
  };
  strategy: {
    documentId?: string;
    basisStatus: StrategyBasisStatus;
    creativeConcepts: NonNullable<ReturnType<typeof strategyData>>["creativeConcepts"];
    creatorMix: NonNullable<ReturnType<typeof strategyData>>["creatorMix"];
  };
  readiness: { status: ContentReadinessStatus; blockers: string[]; warnings: string[] };
  objective?: string;
  audience?: string;
  keyMessages: string[];
  cta?: string;
  /** Existing Campaign Facts KPIs are retained for deterministic, non-blocked plans. */
  kpis: string[];
  /** True only when no Campaign Understanding was supplied to this pure builder. */
  legacyCompatibility: boolean;
  platforms: Array<{ platform: string; priority: "primary" | "secondary" | "optional" | "conditional" | "excluded" }>;
  deliverables: string[];
  durationWeeks?: number;
  creators: ContentContextCreator[];
  requirements: Array<Pick<SemanticFact, "id" | "concept" | "origin" | "status" | "scope" | "condition" | "evidence">>;
};

function strategyData(campaignObject: CampaignObject) {
  return campaignObject.sections.strategy.data as {
    creativeConcepts?: import("@/features/campaign-intelligence/types/section-schemas").CreativeConcept[];
    creatorMix?: import("@/features/campaign-intelligence/types/section-schemas").CreatorMixTier[];
  } | undefined;
}

function relevantToContent(fact: SemanticFact): boolean {
  return !fact.appliesToStages || fact.appliesToStages.includes("content");
}

function contentFact(facts: SemanticFact[], expression: RegExp): SemanticFact | undefined {
  return facts.find((fact) => expression.test(fact.concept) && fact.status !== "unsupported");
}

function stringValue(fact?: SemanticFact): string | undefined {
  if (!fact) return undefined;
  if (typeof fact.value === "string") return fact.value.trim() || undefined;
  return undefined;
}

function resolveStrategyAuthority(
  campaignObject: CampaignObject,
  campaignUnderstanding?: CampaignUnderstanding
): StrategyBasisStatus {
  const pipeline = campaignObject.meta.directorPipeline;
  if (!pipeline?.strategyDocumentId) return "MISSING";
  if (!pipeline.strategyBasis) return "LEGACY_UNKNOWN";
  const current = campaignUnderstanding ? buildStrategyContext(campaignUnderstanding) : undefined;
  // The persisted basis is meaningful but cannot be verified without the
  // current confirmed understanding. Preserve legacy-compatible planning with
  // an explicit warning rather than inventing CURRENT provenance.
  return current ? resolveStrategyBasisStatus(campaignObject, current) : "LEGACY_UNKNOWN";
}

function activeCreators(campaignObject: CampaignObject, draft?: StudioDraftState): ContentContextCreator[] {
  const creatorsData = (
    draft && draft.changes.length > 0
      ? previewCreatorsSectionFromDraft(campaignObject, draft)
      : (campaignObject.sections.creators.data ?? {})
  ) as CreatorsSectionData;
  const slateById = new Map(
    (creatorsData.slateIntelligence?.recommendations ?? []).map((row) => [row.creatorId, row])
  );
  return reconcileCreatorSlateReasoning({
    creatorIds: creatorsData.recommendations?.creatorIds ?? [],
    selectedReasoning: creatorsData.recommendations?.selectedReasoning ?? [],
    normalize: creatorGroupingKey,
  })
    .filter((entry) => entry.creatorId?.trim() && !isCreatorRejected(creatorsData.vendorDecisions, entry.creatorId))
    .map((entry) => {
      const slate = slateById.get(entry.creatorId);
      return {
        creatorId: entry.creatorId,
        creatorName: entry.displayName?.trim() || entry.handle || entry.creatorId,
        creatorRole: entry.expectedRole?.trim() || slate?.role,
        platform: entry.platform?.trim(),
        whySelected: entry.whySelected,
        status: creatorDecisionStatus(creatorsData.vendorDecisions, entry.creatorId),
      };
    });
}

/** Pure, bounded Content boundary. Callers explicitly provide understanding/draft. */
export function buildContentContext(input: {
  campaignObject: CampaignObject;
  campaignUnderstanding?: CampaignUnderstanding;
  draft?: StudioDraftState;
}): ContentContext {
  const { campaignObject, campaignUnderstanding, draft } = input;
  // Content consumes semantic facts only after the existing Campaign
  // Intelligence confirmation boundary. An unconfirmed profile is useful as a
  // warning to the operator, never as a new planning authority.
  const confirmedUnderstanding = campaignUnderstanding?.confirmation.status === "confirmed"
    ? campaignUnderstanding
    : undefined;
  const facts = getCampaignFacts(campaignObject);
  const strategy = strategyData(campaignObject);
  const basisStatus = resolveStrategyAuthority(campaignObject, confirmedUnderstanding);
  const semanticFacts = (confirmedUnderstanding?.facts ?? []).filter(relevantToContent);
  const context = confirmedUnderstanding ? buildStrategyContext(confirmedUnderstanding) : undefined;
  const directives = context?.platformDirectives ?? [];
  const excluded = new Set(directives.filter((item) => item.priority === "excluded").map((item) => item.platform.toLowerCase()));
  const platforms = directives.length > 0
    ? directives.map((item) => ({ platform: item.platform, priority: item.priority }))
    : (facts?.platforms ?? []).map((platform) => ({ platform, priority: "primary" as const }));
  const blockers: string[] = [];
  const warnings: string[] = [];
  const contentGate = confirmedUnderstanding
    ? evaluateCampaignUnderstandingQualityGate(confirmedUnderstanding, { stage: "content", requiresConfirmation: true })
    : undefined;

  if (contentGate?.status === "blocked") blockers.push(...contentGate.assessments.filter((item) => item.status === "blocked").map((item) => item.reason));
  if (contentGate?.status === "warning") warnings.push(...contentGate.assessments.filter((item) => item.status === "warning").map((item) => item.reason));
  if (basisStatus === "BLOCKED") blockers.push("Strategy is blocked and cannot authoritatively guide Content.");
  if (basisStatus === "STALE") blockers.push("Strategy is stale against the current confirmed Campaign Understanding.");
  if (basisStatus === "LEGACY_UNKNOWN") warnings.push("Strategy provenance cannot be confirmed for this campaign.");
  if (basisStatus === "MISSING") warnings.push("No canonical Strategy basis is available; Content uses confirmed compatibility inputs only.");
  if (campaignUnderstanding && !confirmedUnderstanding) warnings.push("Campaign Understanding is not confirmed for Content.");

  const cta = stringValue(contentFact(semanticFacts, /(^|_)(cta|call_to_action)(_|$)/i));
  if (!cta) warnings.push("CTA is not confirmed for Content.");
  const creators = activeCreators(campaignObject, draft);
  const creatorPlatforms = creators.map((creator) => creator.platform?.toLowerCase()).filter(Boolean) as string[];
  if (creatorPlatforms.some((platform) => excluded.has(platform))) {
    blockers.push("The active slate includes a creator on an excluded platform.");
  }
  if (directives.some((item) => item.priority === "primary") && creators.length > 0) {
    const primary = new Set(directives.filter((item) => item.priority === "primary").map((item) => item.platform.toLowerCase()));
    if (!creatorPlatforms.some((platform) => primary.has(platform))) warnings.push("The active slate has no creator explicitly mapped to a primary platform.");
  }

  return {
    ...(confirmedUnderstanding ? {
      campaignUnderstanding: {
        schemaVersion: confirmedUnderstanding.schemaVersion,
        confirmationStatus: confirmedUnderstanding.confirmation.status,
        confirmedFactIds: [...confirmedUnderstanding.confirmation.confirmedFactIds].sort(),
      },
    } : {}),
    strategy: {
      documentId: campaignObject.meta.directorPipeline?.strategyDocumentId,
      basisStatus,
      // Never consume unproven Strategy text when the basis is absent. Legacy
      // campaigns remain readable, but the warning makes that compatibility
      // path explicit rather than treating it as CURRENT.
      creativeConcepts: basisStatus === "CURRENT" || basisStatus === "LEGACY_UNKNOWN" ? strategy?.creativeConcepts : undefined,
      creatorMix: basisStatus === "CURRENT" || basisStatus === "LEGACY_UNKNOWN" ? strategy?.creatorMix : undefined,
    },
    readiness: { status: blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "READY", blockers, warnings },
    objective: facts?.objective,
    audience: facts?.audience,
    keyMessages: semanticFacts.filter((fact) => /key_message|proposition|communication_direction/i.test(fact.concept)).map((fact) => String(fact.value)),
    cta,
    kpis: facts?.kpis ?? [],
    legacyCompatibility: !confirmedUnderstanding,
    platforms: platforms.filter((item) => !excluded.has(item.platform.toLowerCase())),
    deliverables: facts?.deliverables ?? [],
    durationWeeks: facts?.durationWeeks,
    creators,
    requirements: semanticFacts.map(({ id, concept, origin, status, scope, condition, evidence }) => ({ id, concept, origin, status, scope, condition, evidence })),
  };
}
