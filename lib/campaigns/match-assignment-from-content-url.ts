import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { extractHandleFromContentUrl } from "@/lib/social/extract-handle-from-content-url";
import {
  detectSocialPlatformFromContentUrl,
  normalizeUsername,
} from "@/lib/social/platforms";

export type AssignmentMatchCandidate = {
  id: string;
  influencer_id?: string | null;
  influencer_name?: string | null;
  platform?: string | null;
  creator_platform_accounts?: readonly { platform: string; handle: string }[] | null;
  assignment?: {
    influencer_name?: string | null;
    platforms?: readonly { platform: string; handle: string }[] | null;
  } | null;
};

type HandleHit = { platform: string; handle: string };

function handlesForLine(line: AssignmentMatchCandidate): HandleHit[] {
  const hits: HandleHit[] = [];
  const seen = new Set<string>();

  const push = (platform: string | null | undefined, raw: string | null | undefined) => {
    const handle = normalizeUsername(raw ?? "");
    if (!handle) return;
    const key = `${canonicalPlatformKey(platform) || "*"}:${handle}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ platform: canonicalPlatformKey(platform) || "", handle });
  };

  for (const account of line.creator_platform_accounts ?? []) {
    push(account.platform, account.handle);
  }
  for (const platform of line.assignment?.platforms ?? []) {
    push(platform.platform, platform.handle);
  }

  const names = [line.influencer_name, line.assignment?.influencer_name];
  for (const name of names) {
    const embedded = name?.match(/@([a-zA-Z0-9._]+)/)?.[1];
    if (embedded) push(line.platform, embedded);
  }

  return hits;
}

function urlContainsHandle(contentUrl: string, handle: string): boolean {
  const needle = normalizeUsername(handle);
  if (!needle || needle.length < 2) return false;
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(contentUrl.trim()) ? contentUrl.trim() : `https://${contentUrl.trim()}`
    );
    const haystack = `${parsed.pathname}${parsed.search}`.toLowerCase();
    return (
      haystack.includes(`/@${needle}`) ||
      haystack.includes(`/${needle}/`) ||
      haystack.endsWith(`/${needle}`) ||
      haystack.includes(`/${needle}?`)
    );
  } catch {
    return contentUrl.toLowerCase().includes(needle);
  }
}

/**
 * Match a content URL to a campaign assignment line via platform handle.
 * Prefers exact platform+handle; falls back to handle-only / URL substring /
 * unique platform assignee when unambiguous.
 */
export function matchAssignmentLineFromContentUrl<T extends AssignmentMatchCandidate>(
  contentUrl: string | null | undefined,
  lines: readonly T[]
): T | null {
  if (!contentUrl?.trim() || lines.length === 0) return null;

  const extracted = extractHandleFromContentUrl(contentUrl);
  const urlPlatform = detectSocialPlatformFromContentUrl(contentUrl);

  const platformMatches: T[] = [];
  const handleMatches: T[] = [];
  const substringMatches: T[] = [];

  for (const line of lines) {
    const accounts = handlesForLine(line);
    let handleHit = false;
    let platformHit = false;
    let substringHit = false;

    for (const account of accounts) {
      if (extracted && account.handle === extracted.handle) {
        handleHit = true;
        if (
          !extracted.platform ||
          !account.platform ||
          account.platform === extracted.platform
        ) {
          platformHit = true;
        }
      }
      if (urlContainsHandle(contentUrl, account.handle)) {
        substringHit = true;
        if (urlPlatform && account.platform && account.platform === urlPlatform) {
          platformHit = true;
          handleHit = true;
        }
      }
    }

    if (platformHit) platformMatches.push(line);
    else if (handleHit) handleMatches.push(line);
    else if (substringHit) substringMatches.push(line);
  }

  if (platformMatches.length === 1) return platformMatches[0]!;
  if (platformMatches.length === 0 && handleMatches.length === 1) {
    return handleMatches[0]!;
  }
  if (
    platformMatches.length === 0 &&
    handleMatches.length === 0 &&
    substringMatches.length === 1
  ) {
    return substringMatches[0]!;
  }

  // Bare IG/FB permalinks omit the username — if only one assignment owns that
  // platform on the campaign, auto-assign it.
  if (urlPlatform && !extracted) {
    const platformLines = lines.filter((line) => {
      const accounts = handlesForLine(line);
      if (accounts.some((account) => account.platform === urlPlatform)) return true;
      return canonicalPlatformKey(line.platform) === urlPlatform;
    });
    if (platformLines.length === 1) return platformLines[0]!;
  }

  return null;
}
