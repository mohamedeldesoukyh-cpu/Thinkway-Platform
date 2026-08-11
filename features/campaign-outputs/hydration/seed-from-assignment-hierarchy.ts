/**
 * Seed Studio creator slate from campaign assignment hierarchy when empty.
 * Used so Media Plan generate/regenerate can schedule campaign vendors
 * even if Studio never ran quotation / Discovery hydration.
 *
 * Release 2.1: one slate entry per Assignment (`campaign_lines.id`) with
 * durable operational refs carried onto the slate.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { sanitizeAssignmentCreatorName } from "@/lib/campaigns/assignment-line-naming";
import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";
import { resolveSlate } from "@/features/campaign-outputs/output-inputs";

import { bindAssignmentRefsOntoCampaignObject } from "./bind-assignment-refs";
import { hydrateCampaignObject } from "./hydrate";
import type { SeedCreator } from "./hydration-types";

export function seedCreatorsFromAssignmentHierarchy(
  hierarchy: AssignmentHierarchy
): SeedCreator[] {
  // Key by Assignment ID so multiple lines never collapse incorrectly.
  const byLineId = new Map<string, SeedCreator>();

  for (const group of hierarchy.groups) {
    const campaignLineId = group.line.id?.trim();
    if (!campaignLineId) continue;

    const creatorId = group.line.influencer_id?.trim() || campaignLineId;

    const serviceTypes = [
      ...new Set(
        group.deliverables
          .flatMap((deliverable) => {
            if (deliverable.posts.length > 0) {
              return deliverable.posts.map(
                (post) =>
                  post.deliverable_type_label ||
                  post.deliverable_type ||
                  deliverable.label
              );
            }
            return [deliverable.deliverable_type_label || deliverable.label];
          })
          .filter((label) => Boolean(label?.trim()))
      ),
    ];

    const platform =
      group.deliverables.find((d) => d.platform?.trim())?.platform?.trim() ||
      undefined;

    const primaryDeliverable = group.deliverables[0];
    const primaryPost = primaryDeliverable?.posts[0];

    const existing = byLineId.get(campaignLineId);
    if (existing) {
      existing.serviceTypes = [
        ...new Set([...(existing.serviceTypes ?? []), ...serviceTypes]),
      ];
      if (!existing.platform && platform) existing.platform = platform;
      continue;
    }

    byLineId.set(campaignLineId, {
      creatorId,
      displayName: sanitizeAssignmentCreatorName(
        group.line.influencer_name,
        "Creator"
      ),
      platform,
      avatarUrl:
        group.line.influencer_avatar_url?.trim() ||
        group.line.creator_avatar_url?.trim() ||
        undefined,
      serviceTypes: serviceTypes.length ? serviceTypes : undefined,
      serviceLabel: serviceTypes.length ? serviceTypes.join(" + ") : undefined,
      campaignLineId,
      assignmentDeliverableId: primaryDeliverable?.id ?? null,
      assignmentPostScheduleId: primaryPost?.id ?? null,
    });
  }

  return [...byLineId.values()];
}

/**
 * Fill `sections.creators` from campaign assignments when the slate is empty.
 * Always patches missing avatar URLs from Assignments (Remaining/Original cards).
 * Always binds Assignment IDs onto existing slate rows when missing (R2.1).
 */
export function ensureCreatorsFromAssignmentHierarchy(
  campaignObject: CampaignObject,
  hierarchy: AssignmentHierarchy
): CampaignObject {
  let next = campaignObject;

  if (resolveSlate(next).length === 0) {
    const creators = seedCreatorsFromAssignmentHierarchy(hierarchy);
    if (creators.length) {
      next = hydrateCampaignObject(
        { source: "existing_campaign", creators },
        next
      ).campaignObject;
    }
  } else {
    next = patchMissingSlateAvatarsFromHierarchy(next, hierarchy);
  }

  return bindAssignmentRefsOntoCampaignObject(next, hierarchy);
}

/** Patch blank slate avatars from Assignment line avatar fields (in-memory only). */
export function patchMissingSlateAvatarsFromHierarchy(
  campaignObject: CampaignObject,
  hierarchy: AssignmentHierarchy
): CampaignObject {
  const avatarByKey = new Map<string, string>();
  for (const group of hierarchy.groups) {
    const url =
      group.line.influencer_avatar_url?.trim() ||
      group.line.creator_avatar_url?.trim() ||
      "";
    if (!url) continue;
    const lineId = group.line.id?.trim();
    const influencerId = group.line.influencer_id?.trim();
    if (lineId) avatarByKey.set(lineId.toLowerCase(), url);
    if (influencerId) avatarByKey.set(influencerId.toLowerCase(), url);
  }
  if (!avatarByKey.size) return campaignObject;

  const creatorsSection = campaignObject.sections.creators;
  const data = (creatorsSection?.data ?? {}) as {
    recommendations?: {
      creatorIds?: string[];
      selectedReasoning?: Array<{
        creatorId: string;
        avatarUrl?: string;
        campaignLineId?: string | null;
        [key: string]: unknown;
      }>;
    };
  };
  const reasoning = data.recommendations?.selectedReasoning ?? [];
  if (!reasoning.length) return campaignObject;

  let changed = false;
  const patchedReasoning = reasoning.map((entry) => {
    if (typeof entry.avatarUrl === "string" && entry.avatarUrl.trim()) return entry;
    const keys = [
      entry.campaignLineId?.trim().toLowerCase(),
      entry.creatorId?.trim().toLowerCase(),
    ].filter(Boolean) as string[];
    const avatarUrl = keys.map((key) => avatarByKey.get(key)).find(Boolean);
    if (!avatarUrl) return entry;
    changed = true;
    return { ...entry, avatarUrl };
  });
  if (!changed) return campaignObject;

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...creatorsSection,
        data: {
          ...data,
          recommendations: {
            ...data.recommendations,
            selectedReasoning: patchedReasoning,
          },
        },
      },
    },
  };
}
