/**
 * Seed Studio creator slate from campaign assignment hierarchy when empty.
 * Used so Media Plan generate/regenerate can schedule campaign vendors
 * even if Studio never ran quotation / Discovery hydration.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";
import { resolveSlate } from "@/features/campaign-outputs/output-inputs";

import { hydrateCampaignObject } from "./hydrate";
import type { SeedCreator } from "./hydration-types";

export function seedCreatorsFromAssignmentHierarchy(
  hierarchy: AssignmentHierarchy
): SeedCreator[] {
  const byId = new Map<string, SeedCreator>();

  for (const group of hierarchy.groups) {
    const creatorId = group.line.influencer_id?.trim();
    if (!creatorId) continue;

    const serviceTypes = [
      ...new Set(
        group.deliverables.flatMap((deliverable) => {
          if (deliverable.posts.length > 0) {
            return deliverable.posts.map(
              (post) =>
                post.deliverable_type_label ||
                post.deliverable_type ||
                deliverable.label
            );
          }
          return [deliverable.deliverable_type_label || deliverable.label];
        }).filter((label) => Boolean(label?.trim()))
      ),
    ];

    const platform =
      group.deliverables.find((d) => d.platform?.trim())?.platform?.trim() ||
      undefined;

    const existing = byId.get(creatorId);
    if (existing) {
      existing.serviceTypes = [
        ...new Set([...(existing.serviceTypes ?? []), ...serviceTypes]),
      ];
      if (!existing.platform && platform) existing.platform = platform;
      continue;
    }

    byId.set(creatorId, {
      creatorId,
      displayName: group.line.influencer_name?.trim() || "Creator",
      platform,
      avatarUrl: group.line.influencer_avatar_url?.trim() || undefined,
      serviceTypes: serviceTypes.length ? serviceTypes : undefined,
      serviceLabel: serviceTypes.length ? serviceTypes.join(" + ") : undefined,
    });
  }

  return [...byId.values()];
}

/**
 * Fill `sections.creators` from campaign assignments when the slate is empty.
 * Does not overwrite an existing Studio / quotation slate.
 */
export function ensureCreatorsFromAssignmentHierarchy(
  campaignObject: CampaignObject,
  hierarchy: AssignmentHierarchy
): CampaignObject {
  if (resolveSlate(campaignObject).length > 0) {
    return campaignObject;
  }

  const creators = seedCreatorsFromAssignmentHierarchy(hierarchy);
  if (!creators.length) {
    return campaignObject;
  }

  return hydrateCampaignObject(
    { source: "existing_campaign", creators },
    campaignObject
  ).campaignObject;
}
