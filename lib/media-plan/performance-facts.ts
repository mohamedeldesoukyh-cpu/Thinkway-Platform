import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";

import type { MediaPlanPerformanceFact } from "./types";

function isBillingLockedStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").trim().toLowerCase();
  return (
    value.includes("invoice") ||
    value === "billed" ||
    value === "paid" ||
    value === "locked"
  );
}

/**
 * Map operational assignment hierarchy → Media Plan Engine performance facts.
 * Completed = has a live date (Performance Live Date entered).
 * Assignment IDs are always emitted (Release 2.1 authoritative join).
 */
export function performanceFactsFromAssignmentHierarchy(
  hierarchy: AssignmentHierarchy
): MediaPlanPerformanceFact[] {
  const facts: MediaPlanPerformanceFact[] = [];

  for (const group of hierarchy.groups) {
    const campaignLineId = group.line.id;
    const creatorId = group.line.influencer_id?.trim() || campaignLineId;
    const creatorName = group.line.influencer_name ?? null;

    for (const deliverable of group.deliverables) {
      if (deliverable.posts.length > 0) {
        for (const post of deliverable.posts) {
          facts.push({
            creatorId: String(creatorId),
            creatorName,
            platform: post.platform || deliverable.platform || "Unknown",
            deliverable:
              post.deliverable_type_label ||
              post.deliverable_type ||
              deliverable.label,
            liveDate: post.live_date,
            completed: Boolean(post.live_date),
            campaignLineId,
            assignmentDeliverableId: deliverable.id,
            assignmentPostScheduleId: post.id,
            isLocked: Boolean(post.is_locked || deliverable.is_locked),
            billingLocked:
              Boolean(post.is_locked || deliverable.is_locked) ||
              isBillingLockedStatus(post.billing_status) ||
              isBillingLockedStatus(deliverable.billing_status),
          });
        }
        continue;
      }

      facts.push({
        creatorId: String(creatorId),
        creatorName,
        platform: deliverable.platform || "Unknown",
        deliverable: deliverable.deliverable_type_label || deliverable.label,
        liveDate: deliverable.live_date,
        completed: Boolean(deliverable.live_date),
        campaignLineId,
        assignmentDeliverableId: deliverable.id,
        assignmentPostScheduleId: null,
        isLocked: Boolean(deliverable.is_locked),
        billingLocked:
          Boolean(deliverable.is_locked) ||
          isBillingLockedStatus(deliverable.billing_status),
      });
    }
  }

  return facts;
}
