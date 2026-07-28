import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";

import type { MediaPlanPerformanceFact } from "./types";

/**
 * Map operational assignment hierarchy → Media Plan Engine performance facts.
 * Completed = has a live date (Performance Live Date entered).
 */
export function performanceFactsFromAssignmentHierarchy(
  hierarchy: AssignmentHierarchy
): MediaPlanPerformanceFact[] {
  const facts: MediaPlanPerformanceFact[] = [];

  for (const group of hierarchy.groups) {
    for (const deliverable of group.deliverables) {
      const creatorId = group.line.influencer_id ?? group.line.id;
      const creatorName = group.line.influencer_name ?? null;

      if (deliverable.posts.length > 0) {
        for (const post of deliverable.posts) {
          facts.push({
            creatorId: String(creatorId),
            creatorName,
            platform: post.platform || deliverable.platform || "Unknown",
            deliverable: post.deliverable_type_label || post.deliverable_type || deliverable.label,
            liveDate: post.live_date,
            completed: Boolean(post.live_date),
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
      });
    }
  }

  return facts;
}
