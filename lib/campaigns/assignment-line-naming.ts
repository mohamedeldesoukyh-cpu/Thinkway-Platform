import { deliverableTypeShortLabel } from "@/lib/campaigns/deliverable-taxonomy";

type DeliverableNamingInput = {
  platform: string;
  deliverable_type: string;
  posts_count: number;
};

export function buildAssignmentDisplayName(
  influencerName: string,
  deliverables: DeliverableNamingInput[]
): string {
  if (deliverables.length === 0) {
    return influencerName;
  }

  const platforms = [...new Set(deliverables.map((d) => d.platform))];
  if (platforms.length > 1) {
    return `${influencerName} — Multi-platform package`;
  }

  const first = deliverables[0];
  const typeLabel = deliverableTypeShortLabel(first.deliverable_type);
  const totalPosts = deliverables.reduce((sum, d) => sum + Math.max(1, d.posts_count), 0);

  if (totalPosts <= 1) {
    return `${influencerName} — ${typeLabel}`;
  }

  return `${influencerName} — ${typeLabel} + ${totalPosts - 1} more`;
}
