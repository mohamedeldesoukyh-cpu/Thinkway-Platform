import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  normalizePublicationContent,
  type NormalizedPublicationContent,
} from "@/lib/performance/content-normalizer";

function readNestedCaption(edge: unknown): string | null {
  if (!edge || typeof edge !== "object") return null;
  const edges = (edge as { edges?: unknown[] }).edges;
  if (!Array.isArray(edges) || edges.length === 0) return null;
  for (const item of edges) {
    if (!item || typeof item !== "object") continue;
    const text = (item as { node?: { text?: unknown } }).node?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return null;
}

function stringFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function tokensFromArrayField(value: unknown, keys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    for (const key of keys) {
      const token = stringFromUnknown(row[key]);
      if (token) {
        out.push(token);
        break;
      }
    }
  }
  return out;
}

function instagramCaption(row: Record<string, unknown>): string | null {
  return (
    stringFromUnknown(row.caption) ??
    stringFromUnknown(row.captionText) ??
    readNestedCaption(row.edge_media_to_caption)
  );
}

function instagramHashtags(row: Record<string, unknown>): string[] {
  return tokensFromArrayField(row.hashtags, ["name", "hashtag", "tag", "text"]);
}

function instagramMentions(row: Record<string, unknown>): string[] {
  const fromArray = tokensFromArrayField(row.mentions, [
    "username",
    "user",
    "name",
    "handle",
  ]);
  const owner = stringFromUnknown(row.ownerUsername);
  if (owner) fromArray.push(owner);
  return fromArray;
}

function tiktokCaption(row: Record<string, unknown>): string | null {
  return (
    stringFromUnknown(row.text) ??
    stringFromUnknown(row.desc) ??
    stringFromUnknown(row.description)
  );
}

function textExtraTokens(
  value: unknown,
  type: "hashtag" | "user"
): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type != null && row.type !== type) continue;
    const token =
      stringFromUnknown(row.hashtagName) ??
      stringFromUnknown(row.userUniqueId) ??
      stringFromUnknown(row.userId) ??
      stringFromUnknown(row.name);
    if (token) out.push(token);
  }
  return out;
}

function tiktokHashtags(row: Record<string, unknown>): string[] {
  const fromHashtags = tokensFromArrayField(row.hashtags, ["name", "hashtag", "title", "id"]);
  const fromChallenges = tokensFromArrayField(row.challenges, ["title", "name", "hashtagName"]);
  const fromTextExtra = textExtraTokens(row.textExtra, "hashtag");
  return [...fromHashtags, ...fromChallenges, ...fromTextExtra];
}

function tiktokMentions(row: Record<string, unknown>): string[] {
  const fromMentions = tokensFromArrayField(row.mentions, [
    "uniqueId",
    "username",
    "user",
    "name",
    "userUniqueId",
  ]);
  const fromDetailed = tokensFromArrayField(row.detailedMentions, [
    "uniqueId",
    "userUniqueId",
    "username",
    "user",
    "name",
  ]);
  const fromTextExtra = textExtraTokens(row.textExtra, "user");
  const authorMeta = row.authorMeta;
  const authorName =
    authorMeta && typeof authorMeta === "object"
      ? stringFromUnknown((authorMeta as Record<string, unknown>).name)
      : null;
  if (authorName) fromMentions.push(authorName);
  return [...fromMentions, ...fromDetailed, ...fromTextExtra];
}

/**
 * Extract caption, hashtags, and mentions from an Apify dataset row.
 */
export function extractPublicationContentFromApifyRow(
  platform: string,
  payload: unknown
): NormalizedPublicationContent | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;

  if (row.error || row.errorDescription) return null;

  let caption: string | null = null;
  let hashtags: string[] = [];
  let mentions: string[] = [];

  const platformKey = canonicalPlatformKey(platform);

  if (platformKey === "instagram") {
    caption = instagramCaption(row);
    hashtags = instagramHashtags(row);
    mentions = instagramMentions(row);
  } else if (platformKey === "tiktok") {
    caption = tiktokCaption(row);
    hashtags = tiktokHashtags(row);
    mentions = tiktokMentions(row);
  } else {
    caption =
      stringFromUnknown(row.caption) ??
      stringFromUnknown(row.captionText) ??
      stringFromUnknown(row.text) ??
      stringFromUnknown(row.description);
    hashtags = tokensFromArrayField(row.hashtags, ["name", "hashtag", "tag", "title"]);
    mentions = tokensFromArrayField(row.mentions, ["username", "uniqueId", "user", "name"]);
  }

  const normalized = normalizePublicationContent({ caption, hashtags, mentions });

  if (!normalized.caption && normalized.hashtag_count === 0 && normalized.mention_count === 0) {
    return null;
  }

  return normalized;
}
