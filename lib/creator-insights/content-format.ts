import { deliverableTypeLabel } from "@/lib/campaigns/deliverable-taxonomy";

import type { ContentFormatFamily } from "./types";

export function contentFormatFamily(
  deliverableOrPublicationType: string | null | undefined,
  providerContentType?: string | null
): ContentFormatFamily {
  const raw = `${deliverableOrPublicationType ?? ""} ${providerContentType ?? ""}`
    .trim()
    .toLowerCase();
  if (!raw) return "other";
  if (raw.includes("carousel") || raw.includes("album") || raw.includes("sidecar")) {
    return "carousel";
  }
  if (raw.includes("story") || raw.includes("stories")) return "story";
  if (raw.includes("live")) return "live";
  if (
    raw.includes("reel") ||
    raw.includes("short") ||
    raw.includes("tiktok_video") ||
    raw.includes("spotlight") ||
    raw.includes("shorts")
  ) {
    return "short_video";
  }
  if (
    raw.includes("youtube_video") ||
    raw.includes("youtube_dedicated") ||
    raw.includes("youtube_integration") ||
    raw.includes("long")
  ) {
    return "long_video";
  }
  if (
    raw.includes("post") ||
    raw.includes("static") ||
    raw.includes("photo") ||
    raw.includes("image") ||
    raw.includes("picture")
  ) {
    return "static_post";
  }
  return "other";
}

export function contentFormatLabel(family: ContentFormatFamily): string {
  switch (family) {
    case "short_video":
      return "short-form videos";
    case "story":
      return "stories";
    case "static_post":
      return "static posts";
    case "carousel":
      return "carousels";
    case "long_video":
      return "longer videos";
    case "live":
      return "live sessions";
    default:
      return "other content";
  }
}

export function contentFormatSingular(family: ContentFormatFamily): string {
  switch (family) {
    case "short_video":
      return "short-form video";
    case "story":
      return "story";
    case "static_post":
      return "static post";
    case "carousel":
      return "carousel";
    case "long_video":
      return "longer video";
    case "live":
      return "live session";
    default:
      return "this format";
  }
}

export function typeLabelForCreator(type: string | null | undefined): string {
  if (!type?.trim()) return "this format";
  return deliverableTypeLabel(type);
}
