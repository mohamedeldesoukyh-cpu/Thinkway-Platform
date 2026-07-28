import { deliverableTypeShortLabel } from "@/lib/campaigns/deliverable-taxonomy";
import {
  decodeHtmlEntities,
  formatCreatorDisplayName,
} from "@/lib/text/decode-html-entities";

type DeliverableNamingInput = {
  platform: string;
  deliverable_type: string;
  posts_count: number;
};

/** Decode scraped og:title entities and strip platform page-title tails for assignment UI. */
export function sanitizeAssignmentCreatorName(
  name: string | null | undefined,
  fallback = "Creator"
): string {
  if (name == null) return fallback;
  const formatted = formatCreatorDisplayName(name);
  if (formatted) return formatted;
  const decoded = decodeHtmlEntities(name.trim());
  return decoded || fallback;
}

export function buildAssignmentDisplayName(
  influencerName: string,
  deliverables: DeliverableNamingInput[]
): string {
  const name = sanitizeAssignmentCreatorName(influencerName);

  if (deliverables.length === 0) {
    return name;
  }

  const platforms = [...new Set(deliverables.map((d) => d.platform))];
  if (platforms.length > 1) {
    return `${name} — Multi-platform package`;
  }

  const first = deliverables[0];
  const typeLabel = deliverableTypeShortLabel(first.deliverable_type);
  const totalPosts = deliverables.reduce((sum, d) => sum + Math.max(1, d.posts_count), 0);

  if (totalPosts <= 1) {
    return `${name} — ${typeLabel}`;
  }

  return `${name} — ${typeLabel} + ${totalPosts - 1} more`;
}
