import type { CampaignObject } from "@/features/campaign-intelligence/types/campaign-object";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import {
  applyFactsToSummaryData,
  getCampaignFacts,
} from "@/features/campaign-director/facts/facts-display-bridge";
import type {
  SummarySectionData,
  TimelineSectionData,
  TimelineSectionExtras,
} from "@/features/campaign-intelligence/types/section-schemas";
import { resolveGoLiveWeek } from "@/features/campaign-studio/services/timeline-duration";
import { markStaleCampaignOutputs } from "@/features/campaign-outputs/output-registry";

import type { CampaignIntelligenceProfile } from "../types/profile";
import { profileToCampaignFacts } from "./profile-to-facts";

/** True when the operator has confirmed CIP as Campaign Facts SSOT. */
export function isCampaignIntelligenceConfirmed(
  profile: Pick<CampaignIntelligenceProfile, "confirmedAt"> | null | undefined
): boolean {
  return Boolean(profile?.confirmedAt?.trim());
}

/** Mark CIP confirmed. DB row status stays `saved`; confirmation lives on profile JSON. */
export function confirmCampaignIntelligenceProfile(
  profile: CampaignIntelligenceProfile,
  confirmedAt = new Date().toISOString()
): CampaignIntelligenceProfile {
  return {
    ...profile,
    schemaVersion: 1,
    status: profile.status === "archived" ? "archived" : "saved",
    confirmedAt,
  };
}

/** Persist edits as draft/saved and require a new Confirm before facts projection. */
export function unconfirmCampaignIntelligenceProfile(
  profile: CampaignIntelligenceProfile
): CampaignIntelligenceProfile {
  const next: CampaignIntelligenceProfile = {
    ...profile,
    status: profile.status === "archived" ? "archived" : "saved",
  };
  delete next.confirmedAt;
  return next;
}

/**
 * Only a confirmed CIP may produce Campaign Facts.
 * Unconfirmed / missing CIP returns null — never regex-extract into SSOT.
 */
export function projectConfirmedCampaignFacts(
  profile: CampaignIntelligenceProfile | null | undefined
): CampaignFacts | null {
  if (!profile || !isCampaignIntelligenceConfirmed(profile)) return null;
  return profileToCampaignFacts(profile);
}

/**
 * Authoritative facts for a campaign object.
 * Confirmed CIP wins. Legacy objects that already store `meta.campaignFacts`
 * keep working without `confirmedAt`.
 */
export function resolveCampaignFactsSSot(input: {
  profile?: CampaignIntelligenceProfile | null;
  campaignObject?: Pick<CampaignObject, "meta"> | null;
}): CampaignFacts | undefined {
  const projected = projectConfirmedCampaignFacts(input.profile ?? null);
  if (projected) return projected;
  return getCampaignFacts(input.campaignObject);
}

function isTimelineSectionData(value: unknown): value is TimelineSectionData {
  return Boolean(value && typeof value === "object" && "milestones" in (value as object));
}

/** Drop stored activation when it no longer matches facts duration. */
export function syncStoredTimelineToFacts(campaignObject: CampaignObject): CampaignObject {
  const facts = getCampaignFacts(campaignObject);
  const factsWeeks = facts?.durationWeeks;
  const section = campaignObject.sections.timeline;
  const extras = (section.data ?? {}) as TimelineSectionExtras;
  const activation = extras.creatorActivationTimeline;
  const content = isTimelineSectionData(section.content) ? section.content : null;

  const activationMatches =
    factsWeeks != null &&
    Boolean(activation?.activationWeeks?.length) &&
    activation!.durationWeeks === factsWeeks;

  if (activationMatches) {
    if (!content || content.durationWeeks === factsWeeks) {
      return campaignObject;
    }
    return {
      ...campaignObject,
      sections: {
        ...campaignObject.sections,
        timeline: {
          ...section,
          content: {
            ...content,
            durationWeeks: factsWeeks,
            goLiveWeek: resolveGoLiveWeek(factsWeeks),
          },
        },
      },
      updatedAt: new Date().toISOString(),
    };
  }

  const nextExtras: TimelineSectionExtras = { ...extras };
  if (!activationMatches) {
    delete nextExtras.creatorActivationTimeline;
  }

  const nextContent = content
    ? {
        ...content,
        durationWeeks: factsWeeks,
        goLiveWeek: factsWeeks != null ? resolveGoLiveWeek(factsWeeks) : content.goLiveWeek,
      }
    : section.content;

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      timeline: {
        ...section,
        content: nextContent,
        data: nextExtras,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Write confirmed facts onto the campaign object and keep timeline duration in sync. */
export function applyConfirmedCampaignFactsToCampaignObject(
  campaignObject: CampaignObject,
  facts: CampaignFacts
): CampaignObject {
  const summarySection = campaignObject.sections.summary;
  const summaryData = (summarySection.data ?? {}) as Record<string, unknown>;
  const currentCards = (summaryData.summaryCards ?? {}) as SummarySectionData;
  const nextCards = applyFactsToSummaryData(currentCards, facts);

  const next: CampaignObject = {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      summary: {
        ...summarySection,
        data: { ...summaryData, summaryCards: nextCards },
      },
    },
    meta: { ...campaignObject.meta, campaignFacts: facts },
    updatedAt: new Date().toISOString(),
  };

  return markStaleCampaignOutputs(syncStoredTimelineToFacts(next));
}
