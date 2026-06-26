/**
 * Normalize publication caption, hashtags, and mentions for storage and display.
 */

export type NormalizedPublicationContent = {
  caption: string | null;
  hashtags: string[];
  mentions: string[];
  hashtag_count: number;
  mention_count: number;
};

/** Supports Latin, digits, underscore, and Arabic letters in hashtags. */
const HASHTAG_IN_TEXT_RE = /#([\w\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+)/gu;

/** Mentions: standard social handles (Latin + digits + underscore/dot). */
const MENTION_IN_TEXT_RE = /@([a-zA-Z0-9._]{1,64})/g;

export function extractHashtagsFromCaption(caption: string | null | undefined): string[] {
  if (!caption?.trim()) return [];
  const found: string[] = [];
  for (const match of caption.matchAll(HASHTAG_IN_TEXT_RE)) {
    const tag = match[1]?.trim();
    if (tag) found.push(tag);
  }
  return found;
}

export function extractMentionsFromCaption(caption: string | null | undefined): string[] {
  if (!caption?.trim()) return [];
  const found: string[] = [];
  for (const match of caption.matchAll(MENTION_IN_TEXT_RE)) {
    const handle = match[1]?.trim();
    if (handle) found.push(handle);
  }
  return found;
}

export function normalizeHashtagToken(value: string): string | null {
  const trimmed = value.trim().replace(/^#+/, "");
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function normalizeMentionToken(value: string): string | null {
  const trimmed = value.trim().replace(/^@+/, "");
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function dedupeNormalizedTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function formatHashtagsForStorage(hashtags: string[]): string | null {
  const normalized = dedupeNormalizedTokens(
    hashtags
      .map((tag) => normalizeHashtagToken(tag))
      .filter((tag): tag is string => Boolean(tag))
  );
  if (normalized.length === 0) return null;
  return normalized.map((tag) => `#${tag}`).join(" ");
}

export function formatMentionsForStorage(mentions: string[]): string | null {
  const normalized = dedupeNormalizedTokens(
    mentions
      .map((mention) => normalizeMentionToken(mention))
      .filter((mention): mention is string => Boolean(mention))
  );
  if (normalized.length === 0) return null;
  return normalized.map((mention) => `@${mention}`).join(" ");
}

export function countStorageTags(value: string | null | undefined): number {
  if (!value?.trim()) return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizePublicationContent(input: {
  caption?: string | null;
  hashtags?: string[] | null;
  mentions?: string[] | null;
}): NormalizedPublicationContent {
  const caption = input.caption?.trim() || null;

  let hashtagTokens = (input.hashtags ?? [])
    .map((tag) => normalizeHashtagToken(tag))
    .filter((tag): tag is string => Boolean(tag));

  let mentionTokens = (input.mentions ?? [])
    .map((mention) => normalizeMentionToken(mention))
    .filter((mention): mention is string => Boolean(mention));

  if (caption) {
    if (hashtagTokens.length === 0) {
      hashtagTokens = extractHashtagsFromCaption(caption)
        .map((tag) => normalizeHashtagToken(tag))
        .filter((tag): tag is string => Boolean(tag));
    }
    if (mentionTokens.length === 0) {
      mentionTokens = extractMentionsFromCaption(caption)
        .map((mention) => normalizeMentionToken(mention))
        .filter((mention): mention is string => Boolean(mention));
    }
  }

  const hashtags = dedupeNormalizedTokens(hashtagTokens);
  const mentions = dedupeNormalizedTokens(mentionTokens);

  return {
    caption,
    hashtags,
    mentions,
    hashtag_count: hashtags.length,
    mention_count: mentions.length,
  };
}

export function normalizedContentToStorageFields(
  content: NormalizedPublicationContent
): {
  caption: string | null;
  hashtags: string | null;
  mentions: string | null;
  hashtag_count: number;
  mention_count: number;
} {
  return {
    caption: content.caption,
    hashtags: formatHashtagsForStorage(content.hashtags),
    mentions: formatMentionsForStorage(content.mentions),
    hashtag_count: content.hashtag_count,
    mention_count: content.mention_count,
  };
}
