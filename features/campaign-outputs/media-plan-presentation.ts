/**
 * Media Plan presentation config — section visibility, standard vs strategy mode,
 * and client vs internal view. Persisted on campaign object meta.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type { MediaPlanStrategyBlock } from "./media-plan-strategy-blocks";

export type MediaPlanPresentationMode = "standard" | "strategy";

export type InfluencerConceptsExportLevel = "summary" | "full" | "none";

export type MediaPlanViewMode = "internal" | "client";

export type MediaPlanExportLanguage = "en" | "ar" | "bilingual";

export type MediaPlanSectionKey =
  | "executiveSummary"
  | "objectives"
  | "platformIntelligence"
  | "creatorMix"
  | "weeklyObjectives"
  | "creativeDirection"
  | "influencerConcepts"
  | "publishingCalendar"
  | "campaignOperations"
  | "productionSchedule"
  | "marketTiming";

export type MediaPlanSectionVisibility = Record<MediaPlanSectionKey, boolean>;

export type CreativeDirectionSubsectionKey =
  | "thinkwayRecommendations"
  | "uploadedConcepts"
  | "creatorContentTypes"
  | "influencerConcepts";

export type CreativeDirectionSubsectionVisibility = Record<CreativeDirectionSubsectionKey, boolean>;

export type MediaPlanPresentationConfig = {
  mode: MediaPlanPresentationMode;
  sections: MediaPlanSectionVisibility;
  creativeDirectionSubsections: CreativeDirectionSubsectionVisibility;
  /** Export-only: how influencer concepts appear in PDF/PPT/HTML. */
  influencerConceptsExport?: InfluencerConceptsExportLevel;
  /** Internal workspace shows AI rationale; client output hides scoring labels. */
  view?: MediaPlanViewMode;
  /** Export language for influencer concepts and bilingual sections. */
  exportLanguage?: MediaPlanExportLanguage;
  /** Strategy export: include production schedule section. */
  includeProductionSchedule?: boolean;
  /** Strategy export: include internal approval / AI notes. */
  includeInternalNotes?: boolean;
  /**
   * Export-only: show campaign cost on cover / meta.
   * Defaults to true. Set false for Calendar and Deliverables exports.
   */
  includeCampaignCost?: boolean;
};

/**
 * Partial update applied via merge — section maps may omit keys.
 * Distinct from `Partial<MediaPlanPresentationConfig>`, which still requires
 * complete `sections` / `creativeDirectionSubsections` when those fields are set.
 */
export type MediaPlanPresentationPatch = Omit<
  Partial<MediaPlanPresentationConfig>,
  "sections" | "creativeDirectionSubsections"
> & {
  sections?: Partial<MediaPlanSectionVisibility>;
  creativeDirectionSubsections?: Partial<CreativeDirectionSubsectionVisibility>;
};

const SECTION_DEFAULTS_STANDARD: MediaPlanSectionVisibility = {
  executiveSummary: true,
  objectives: true,
  platformIntelligence: false,
  creatorMix: true,
  weeklyObjectives: false,
  creativeDirection: true,
  influencerConcepts: true,
  publishingCalendar: true,
  campaignOperations: true,
  productionSchedule: true,
  marketTiming: false,
};

const SECTION_DEFAULTS_STRATEGY: MediaPlanSectionVisibility = {
  executiveSummary: true,
  objectives: true,
  platformIntelligence: true,
  creatorMix: true,
  weeklyObjectives: true,
  creativeDirection: true,
  influencerConcepts: true,
  publishingCalendar: true,
  campaignOperations: true,
  productionSchedule: true,
  marketTiming: true,
};

const CREATIVE_SUBSECTION_DEFAULTS: CreativeDirectionSubsectionVisibility = {
  thinkwayRecommendations: true,
  uploadedConcepts: true,
  creatorContentTypes: true,
  influencerConcepts: true,
};

export function defaultSectionsForMode(mode: MediaPlanPresentationMode): MediaPlanSectionVisibility {
  return mode === "strategy"
    ? { ...SECTION_DEFAULTS_STRATEGY }
    : { ...SECTION_DEFAULTS_STANDARD };
}

export function defaultMediaPlanPresentation(
  mode: MediaPlanPresentationMode = "standard"
): MediaPlanPresentationConfig {
  return {
    mode,
    sections: defaultSectionsForMode(mode),
    creativeDirectionSubsections: { ...CREATIVE_SUBSECTION_DEFAULTS },
    influencerConceptsExport: "summary",
    view: "internal",
    exportLanguage: "en",
    includeProductionSchedule: true,
    includeInternalNotes: false,
    includeCampaignCost: true,
  };
}

export function mergeMediaPlanPresentation(
  existing: MediaPlanPresentationConfig | undefined,
  patch: MediaPlanPresentationPatch
): MediaPlanPresentationConfig {
  const mode = patch.mode ?? existing?.mode ?? "standard";
  const modeChanged =
    existing !== undefined &&
    patch.mode !== undefined &&
    patch.mode !== existing.mode;

  return {
    mode,
    sections: modeChanged
      ? defaultSectionsForMode(mode)
      : { ...defaultSectionsForMode(mode), ...existing?.sections, ...patch.sections },
    creativeDirectionSubsections: {
      ...CREATIVE_SUBSECTION_DEFAULTS,
      ...existing?.creativeDirectionSubsections,
      ...patch.creativeDirectionSubsections,
    },
    influencerConceptsExport:
      patch.influencerConceptsExport ?? existing?.influencerConceptsExport ?? "summary",
    view: patch.view ?? existing?.view ?? "internal",
    exportLanguage: patch.exportLanguage ?? existing?.exportLanguage ?? "en",
    includeProductionSchedule:
      patch.includeProductionSchedule ?? existing?.includeProductionSchedule ?? true,
    includeInternalNotes:
      patch.includeInternalNotes ?? existing?.includeInternalNotes ?? false,
    includeCampaignCost: patch.includeCampaignCost ?? existing?.includeCampaignCost ?? true,
  };
}

export function readMediaPlanPresentation(
  campaignObject: CampaignObject
): MediaPlanPresentationConfig {
  const stored = campaignObject.meta.mediaPlanPresentation;
  if (!stored) return defaultMediaPlanPresentation("standard");
  return mergeMediaPlanPresentation(undefined, stored);
}

export function applyMediaPlanPresentationPatch(
  campaignObject: CampaignObject,
  patch: MediaPlanPresentationPatch
): CampaignObject {
  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      mediaPlanPresentation: mergeMediaPlanPresentation(
        campaignObject.meta.mediaPlanPresentation,
        patch
      ),
    },
    updatedAt: new Date().toISOString(),
  };
}

/** postMessage type — iframe section header toggles notify the preview parent. */
export const MEDIA_PLAN_SECTION_TOGGLE_MESSAGE = "thinkway:media-plan-section-toggle";

export const MEDIA_PLAN_SECTION_LABELS: Record<MediaPlanSectionKey, string> = {
  executiveSummary: "Executive Summary",
  objectives: "Objective & Rollout",
  platformIntelligence: "Platform Intelligence",
  creatorMix: "Creator Mix",
  weeklyObjectives: "Weekly Objectives",
  creativeDirection: "Creative Direction",
  influencerConcepts: "Influencer Concepts",
  publishingCalendar: "Publishing Calendar",
  campaignOperations: "Campaign Operations",
  productionSchedule: "Production Schedule",
  marketTiming: "Market Timing",
};

/** Stable serialization for memo deps — avoids object-reference churn. */
export function serializeMediaPlanPresentationKey(
  config: MediaPlanPresentationConfig | undefined
): string {
  if (!config) return "";
  return JSON.stringify({
    mode: config.mode,
    view: config.view ?? "internal",
    sections: config.sections,
    creativeDirectionSubsections: config.creativeDirectionSubsections,
    influencerConceptsExport: config.influencerConceptsExport,
    exportLanguage: config.exportLanguage,
    includeProductionSchedule: config.includeProductionSchedule,
    includeInternalNotes: config.includeInternalNotes,
  });
}

const BLOCK_LABEL_TO_SECTION: Record<string, MediaPlanSectionKey | undefined> = {
  "Executive Summary": "executiveSummary",
  "Campaign Overview": "objectives",
  Objective: "objectives",
  "Creator Mix": "creatorMix",
  "Creator Mix Intelligence": "creatorMix",
  "Campaign Rollout Strategy": "objectives",
  "Launch Approach": "objectives",
  "Market Timing Intelligence": "marketTiming",
  "Platform Intelligence": "platformIntelligence",
  "Weekly Objectives": "weeklyObjectives",
  "Publishing Rhythm": "weeklyObjectives",
  "Creative Direction": "creativeDirection",
  "Creative Recommendations": "creativeDirection",
  "Creator-Type Content": "creativeDirection",
};

export function isSectionVisible(
  config: MediaPlanPresentationConfig,
  section: MediaPlanSectionKey
): boolean {
  return config.sections[section] !== false;
}

const PAGE_TITLE_TO_SECTION: Record<string, MediaPlanSectionKey | undefined> = {
  "Executive Summary": "executiveSummary",
  "Campaign Strategy": "objectives",
  "Creative Direction": "creativeDirection",
  "Creative Direction (continued)": "creativeDirection",
  "Publishing Calendar": "publishingCalendar",
  "Campaign Operations": "campaignOperations",
  "Production Schedule": "productionSchedule",
  "Production & Asset Delivery Deadlines": "productionSchedule",
};

/** Resolve a presentation section key from a strategy block or page title label. */
export function resolveMediaPlanSectionKey(
  label: string
): MediaPlanSectionKey | undefined {
  return BLOCK_LABEL_TO_SECTION[label] ?? PAGE_TITLE_TO_SECTION[label];
}

/** Filter strategy blocks by presentation section toggles and creative subsections. */
export function filterStrategyBlocksByPresentation(
  blocks: MediaPlanStrategyBlock[],
  config: MediaPlanPresentationConfig
): MediaPlanStrategyBlock[] {
  return blocks
    .map((block) => {
      const sectionKey = BLOCK_LABEL_TO_SECTION[block.label];
      if (sectionKey && !isSectionVisible(config, sectionKey)) return null;

      if (block.label === "Creative Direction" || block.label === "Creative Recommendations") {
        const subs = config.creativeDirectionSubsections;
        const filtered: MediaPlanStrategyBlock = { ...block };

        if (!subs.influencerConcepts) {
          filtered.influencerConcepts = undefined;
        }
        if (!subs.uploadedConcepts && filtered.creativeConceptDisplays?.length) {
          filtered.creativeConceptDisplays = filtered.creativeConceptDisplays.filter(
            (concept) => concept.source !== "brief"
          );
        }
        if (!subs.thinkwayRecommendations) {
          if (filtered.creativeConceptDisplays?.length) {
            filtered.creativeConceptDisplays = filtered.creativeConceptDisplays.filter(
              (concept) => concept.source !== "thinkway"
            );
          }
          if (filtered.creativeItems?.length) {
            filtered.creativeItems = filtered.creativeItems.filter(
              (item) => !/^Thinkway Creative Recommendation/i.test(item.format)
            );
          }
        }

        const hasCreativeContent =
          (filtered.creativeConceptDisplays?.length ?? 0) > 0 ||
          (filtered.creativeItems?.length ?? 0) > 0 ||
          (filtered.influencerConcepts?.length ?? 0) > 0 ||
          Boolean(filtered.body?.trim());

        if (!isSectionVisible(config, "creativeDirection")) return null;
        if (!subs.influencerConcepts && !hasCreativeContent) return null;
        return filtered;
      }

      if (block.label === "Creator-Type Content" && !config.creativeDirectionSubsections.creatorContentTypes) {
        return null;
      }

      return block;
    })
    .filter((block): block is MediaPlanStrategyBlock => block !== null);
}

export type MediaPlanExportPresentationOptions = {
  mode?: MediaPlanPresentationMode;
  influencerConceptsExport?: InfluencerConceptsExportLevel;
  view?: MediaPlanViewMode;
  exportLanguage?: MediaPlanExportLanguage;
  includeProductionSchedule?: boolean;
  includeInternalNotes?: boolean;
  includeCampaignCost?: boolean;
};

/** Resolve export presentation from query params + stored meta. */
export function resolveExportPresentation(
  campaignObject: CampaignObject,
  overrides?: MediaPlanExportPresentationOptions
): MediaPlanPresentationConfig {
  const base = readMediaPlanPresentation(campaignObject);
  const mode = overrides?.mode ?? base.mode;
  const merged = mergeMediaPlanPresentation(base, {
    mode,
    influencerConceptsExport: overrides?.influencerConceptsExport ?? base.influencerConceptsExport,
    view: overrides?.view ?? base.view ?? "internal",
    exportLanguage: overrides?.exportLanguage ?? base.exportLanguage,
    includeProductionSchedule:
      overrides?.includeProductionSchedule ?? base.includeProductionSchedule,
    includeInternalNotes: overrides?.includeInternalNotes ?? false,
    includeCampaignCost: overrides?.includeCampaignCost ?? true,
  });

  if (merged.view === "client") {
    merged.sections.platformIntelligence =
      merged.mode === "strategy" && merged.sections.platformIntelligence;
    merged.includeInternalNotes = false;
  }

  if (merged.includeProductionSchedule === false) {
    merged.sections.productionSchedule = false;
  }

  return merged;
}
