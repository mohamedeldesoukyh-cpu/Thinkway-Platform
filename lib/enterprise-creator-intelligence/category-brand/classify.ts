import { inferCategoriesFromProfileSignals } from "@/lib/creator-enrichment/category-inference";
import { resolveCanonicalCategories } from "@/lib/creator-intelligence/taxonomy";
import {
  extractHashtagsFromCaption,
  extractMentionsFromCaption,
} from "@/lib/performance/content-normalizer";
import { isCreatorRecentPublicationVideo } from "@/lib/creators/recent-publication-thumb";
import type {
  BrandCollaborationKind,
  ContentMixType,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";

export type CategoryBrandPostFact = {
  caption: string | null;
  hashtags: string[];
  mentions: string[];
  postedAt: string | null;
  url: string | null;
  isVideo: boolean | null;
  productType: string | null;
  mediaType: string | number | null;
  type: string | null;
  campaignType: string | null;
};

const SPONSORED_PATTERN =
  /(?:^|[^\w])(?:#ad\b|#sponsored\b|#paidpartnership\b|#paid\b|#gifted\b|paid\s+partnership|partnered\s+with|sponsored\s+by)/i;

/** Classify behavioural categories for one post using existing taxonomy inference. */
export function classifyPostCategories(post: CategoryBrandPostFact): string[] {
  const captionHashtags =
    post.hashtags.length > 0
      ? post.hashtags
      : extractHashtagsFromCaption(post.caption ?? "");
  const captionMentions =
    post.mentions.length > 0
      ? post.mentions
      : extractMentionsFromCaption(post.caption ?? "");

  const inferred = inferCategoriesFromProfileSignals({
    bio: post.caption,
    hashtags: captionHashtags,
    mentions: captionMentions,
    extraTerms: captionHashtags,
  });

  const canonical = resolveCanonicalCategories(inferred);
  return canonical.length > 0 ? canonical : ["Other"];
}

export function classifySponsored(
  post: CategoryBrandPostFact
): BrandCollaborationKind {
  const text = [
    post.caption ?? "",
    ...post.hashtags.map((h) => `#${h.replace(/^#/, "")}`),
  ].join(" ");
  if (!text.trim()) return "Unknown";
  return SPONSORED_PATTERN.test(text) ? "Sponsored" : "Organic";
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/** Content mix classification from publication shape (reuses video heuristics). */
export function classifyContentMixTypes(
  post: CategoryBrandPostFact
): ContentMixType[] {
  const url = (post.url ?? "").toLowerCase();
  const product = (post.productType ?? "").toLowerCase();
  const media =
    typeof post.mediaType === "number"
      ? String(post.mediaType)
      : (post.mediaType ?? "").toString().toLowerCase();
  const type = (post.type ?? "").toLowerCase();
  const isVideo =
    post.isVideo === true ||
    isCreatorRecentPublicationVideo({
      url: post.url,
      isVideo: post.isVideo,
      product_type: post.productType,
      mediaType: post.mediaType,
      type: post.type,
      caption: post.caption,
    });

  const tags = new Set<ContentMixType>();

  if (url.includes("/stories/") || product.includes("story") || type === "story") {
    tags.add("Stories");
  }
  if (
    url.includes("/reel/") ||
    product === "clips" ||
    product === "reels" ||
    type === "reel" ||
    media === "reel"
  ) {
    tags.add("Reels");
    tags.add("Short Form");
  }
  if (
    product.includes("carousel") ||
    product === "sidecar" ||
    media === "8" ||
    media === "carousel" ||
    media === "carousel_album"
  ) {
    tags.add("Carousel");
  }
  if (product === "igtv" || url.includes("/tv/") || type === "igtv") {
    tags.add("Long Form");
    tags.add("Video");
  }
  if (isVideo && !tags.has("Reels") && !tags.has("Long Form")) {
    tags.add("Video");
    tags.add("Short Form");
  }
  if (!isVideo && !tags.has("Carousel") && !tags.has("Stories")) {
    tags.add("Images");
  }

  if (tags.size === 0) tags.add("Other");
  return [...tags];
}

export function normalizeMentionHandle(raw: string): string {
  return raw.replace(/^@+/, "").trim().toLowerCase();
}

export function brandDisplayName(handle: string): string {
  const clean = normalizeMentionHandle(handle);
  if (!clean) return "Unknown";
  return clean
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Map category label → commercial industry label (reuse category vocabulary). */
export function industryFromCategory(category: string): string {
  const map: Record<string, string> = {
    Travel: "Travel",
    Fashion: "Fashion",
    Beauty: "Beauty",
    Food: "Food & Beverage",
    Lifestyle: "Lifestyle",
    Tech: "Technology",
    Gaming: "Technology",
    Fitness: "Health & Fitness",
    "Health & Wellness": "Health & Fitness",
    Sports: "Sports",
    Automotive: "Automotive",
    Entertainment: "Entertainment",
    Parenting: "Family",
    Other: "General",
  };
  return map[category] ?? category;
}

export function extractPostMentions(post: CategoryBrandPostFact): string[] {
  const fromField = post.mentions.map(normalizeMentionHandle).filter(Boolean);
  if (fromField.length > 0) return [...new Set(fromField)];
  return [
    ...new Set(
      extractMentionsFromCaption(post.caption ?? "").map(normalizeMentionHandle)
    ),
  ].filter(Boolean);
}

export function toPostFact(row: Record<string, unknown>): CategoryBrandPostFact {
  const caption =
    str(row.caption) ?? str(row.text) ?? null;
  const hashtags = Array.isArray(row.hashtags)
    ? row.hashtags.map((h) => String(h))
    : extractHashtagsFromCaption(caption ?? "");
  const mentions = Array.isArray(row.mentions)
    ? row.mentions.map((m) => String(m))
    : extractMentionsFromCaption(caption ?? "");

  return {
    caption,
    hashtags,
    mentions,
    postedAt:
      str(row.posted_at) ??
      str(row.publication_date) ??
      str(row.timestamp) ??
      null,
    url: str(row.url) ?? str(row.content_url) ?? str(row.postPage) ?? null,
    isVideo: typeof row.isVideo === "boolean" ? row.isVideo : null,
    productType: str(row.product_type) ?? str(row.productType),
    mediaType: (row.mediaType ?? row.media_type ?? null) as string | number | null,
    type: str(row.type),
    campaignType: str(row.publication_type) ?? str(row.campaign_type),
  };
}
