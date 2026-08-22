import { DELIVERABLE_DECAY_CURVES, type DeliverableDecayFamily } from "./config";

const REEL_TYPES = new Set([
  "instagram_reel",
  "ig_reel",
  "reel",
  "tiktok_video",
  "tt_video",
  "facebook_reel",
  "yt_short",
  "youtube_short",
  "snapchat_spotlight",
]);
const STORY_TYPES = new Set([
  "instagram_story",
  "ig_story",
  "story",
  "tiktok_story",
  "facebook_story",
  "snapchat_story",
]);
const POST_TYPES = new Set([
  "instagram_post",
  "ig_post",
  "photo",
  "carousel",
  "ig_post_carousel",
  "facebook_post",
  "tiktok_photo_post",
]);

export function decayFamilyForContentType(contentType: string): DeliverableDecayFamily {
  const normalized = contentType.trim().toLowerCase();
  if (REEL_TYPES.has(normalized) || normalized.includes("reel")) return "reel";
  if (STORY_TYPES.has(normalized) || normalized.includes("story")) return "story";
  if (POST_TYPES.has(normalized)) return "post";
  if (normalized.includes("video") || normalized.includes("yt_")) return "video";
  return "default";
}

/** Sum of base reach × decay factor for each deliverable unit (diminishing returns). */
export function deliverableDecayMultiplier(contentType: string, quantity: number): number {
  const family = decayFamilyForContentType(contentType);
  const curve = DELIVERABLE_DECAY_CURVES[family];
  const units = Math.max(1, Math.floor(quantity));
  let total = 0;
  for (let index = 0; index < units; index++) {
    total += curve[Math.min(index, curve.length - 1)] ?? curve[curve.length - 1]!;
  }
  return total;
}

export function explainDeliverableDecay(contentType: string, quantity: number): string[] {
  const family = decayFamilyForContentType(contentType);
  const curve = DELIVERABLE_DECAY_CURVES[family];
  const units = Math.max(1, Math.floor(quantity));
  const lines: string[] = [`Deliverable decay model: ${family} (${units} unit${units === 1 ? "" : "s"}).`];
  for (let index = 0; index < units; index++) {
    const factor = curve[Math.min(index, curve.length - 1)] ?? curve[curve.length - 1]!;
    lines.push(`  Unit ${index + 1}: ${Math.round(factor * 100)}% of base reach.`);
  }
  return lines;
}
