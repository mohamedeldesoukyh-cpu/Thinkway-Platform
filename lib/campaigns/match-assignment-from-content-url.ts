import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { extractHandleFromContentUrl } from "@/lib/social/extract-handle-from-content-url";
import { normalizeUsername } from "@/lib/social/platforms";

export type AssignmentMatchCandidate = {
  id: string;
  influencer_id?: string | null;
  creator_platform_accounts?: readonly { platform: string; handle: string }[] | null;
  assignment?: {
    platforms?: readonly { platform: string; handle: string }[] | null;
  } | null;
};

/**
 * Match a content URL to a campaign assignment line via platform handle.
 * Prefers exact platform+handle; falls back to handle-only when unique.
 */
export function matchAssignmentLineFromContentUrl<T extends AssignmentMatchCandidate>(
  contentUrl: string | null | undefined,
  lines: readonly T[]
): T | null {
  const extracted = extractHandleFromContentUrl(contentUrl);
  if (!extracted) return null;

  const wantHandle = normalizeUsername(extracted.handle);
  if (!wantHandle) return null;

  const platformMatches: T[] = [];
  const handleMatches: T[] = [];

  for (const line of lines) {
    const accounts = [
      ...(line.creator_platform_accounts ?? []),
      ...(line.assignment?.platforms ?? []),
    ];
    let handleHit = false;
    let platformHit = false;
    for (const account of accounts) {
      const handle = normalizeUsername(account.handle ?? "");
      if (!handle || handle !== wantHandle) continue;
      handleHit = true;
      if (canonicalPlatformKey(account.platform) === extracted.platform) {
        platformHit = true;
      }
    }
    if (platformHit) platformMatches.push(line);
    else if (handleHit) handleMatches.push(line);
  }

  if (platformMatches.length === 1) return platformMatches[0]!;
  if (platformMatches.length === 0 && handleMatches.length === 1) {
    return handleMatches[0]!;
  }
  return null;
}
