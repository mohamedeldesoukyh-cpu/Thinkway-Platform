/**
 * Release 2.1 — attach Assignment operational refs onto an existing slate.
 * Does not replace creators; only fills missing campaignLineId (and child IDs).
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";

function norm(id: string | null | undefined): string {
  return (id ?? "").trim().toLowerCase();
}

/**
 * Stamp Assignment IDs onto selectedReasoning rows matched by influencer id.
 * Safe for quotation-hydrated slates that predate Release 2.1.
 */
export function bindAssignmentRefsOntoCampaignObject(
  campaignObject: CampaignObject,
  hierarchy: AssignmentHierarchy
): CampaignObject {
  if (!hierarchy.groups.length) return campaignObject;

  const byInfluencer = new Map<
    string,
    {
      campaignLineId: string;
      assignmentDeliverableId: string | null;
      assignmentPostScheduleId: string | null;
    }
  >();

  for (const group of hierarchy.groups) {
    const influencerId = group.line.influencer_id?.trim();
    const campaignLineId = group.line.id?.trim();
    if (!influencerId || !campaignLineId) continue;
    if (byInfluencer.has(norm(influencerId))) continue;
    const primaryDeliverable = group.deliverables[0];
    byInfluencer.set(norm(influencerId), {
      campaignLineId,
      assignmentDeliverableId: primaryDeliverable?.id ?? null,
      assignmentPostScheduleId: primaryDeliverable?.posts[0]?.id ?? null,
    });
  }

  if (!byInfluencer.size) return campaignObject;

  const creatorsData = (campaignObject.sections.creators?.data ?? {}) as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (!reasoning.length) return campaignObject;

  let changed = false;
  const nextReasoning = reasoning.map((entry) => {
    if (entry.campaignLineId?.trim()) return entry;
    const refs = byInfluencer.get(norm(entry.creatorId));
    if (!refs) return entry;
    changed = true;
    return {
      ...entry,
      campaignLineId: refs.campaignLineId,
      assignmentDeliverableId: refs.assignmentDeliverableId,
      assignmentPostScheduleId: refs.assignmentPostScheduleId,
    };
  });

  if (!changed) return campaignObject;

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        data: {
          ...creatorsData,
          recommendations: {
            ...creatorsData.recommendations,
            creatorIds: creatorsData.recommendations?.creatorIds ?? [],
            selectedReasoning: nextReasoning,
          },
        },
      },
    },
  };
}
