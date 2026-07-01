import { isAvatarUrlAllowedForPlatform } from "@/lib/performance/creator-avatar";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import { enrichCreatorProfile } from "@/lib/social/enrichment/providers/open-graph";
import { isSocialPlatform, type SocialPlatform } from "@/lib/social/platforms";

import { isImportFieldEmpty, type ImportMergeLog } from "./merge";
import { importProfilePictureAccountFields } from "./normalize";
import type { ParsedCreatorRow } from "./types";

export type ImportAvatarAccountFields = NonNullable<
  ReturnType<typeof importProfilePictureAccountFields>
>;

export function shouldFillImportAvatar(
  existingProfilePictureUrl: string | null | undefined
): boolean {
  return (
    isImportFieldEmpty(existingProfilePictureUrl) ||
    !isUsableAvatarUrl(existingProfilePictureUrl)
  );
}

/**
 * Resolve import avatar fields for a parsed row.
 * 1. Use profile photo URL from the parsed row when present.
 * 2. Optionally fetch og:image from the canonical profile URL (PDF imports — no Apify).
 */
export async function resolveImportAvatarFields(input: {
  row: ParsedCreatorRow;
  platform: string;
  profileUrl: string | null;
  enableOpenGraphFallback?: boolean;
  log?: ImportMergeLog;
  enrichProfile?: typeof enrichCreatorProfile;
}): Promise<ImportAvatarAccountFields | null> {
  const fromRow = importProfilePictureAccountFields(
    input.row.profile_picture_url,
    input.platform,
    input.row.profile_avatar_source ?? "manual"
  );
  if (fromRow) {
    input.log?.(
      "info",
      `[import] creator avatar detected @${input.row.username} (${input.platform})`
    );
    return fromRow;
  }

  if (!input.enableOpenGraphFallback) return null;

  const profileUrl = input.profileUrl?.trim();
  if (!profileUrl) return null;

  const platform = input.platform.trim().toLowerCase();
  if (!isSocialPlatform(platform)) return null;

  try {
    const enrich = input.enrichProfile ?? enrichCreatorProfile;
    const enrichment = await enrich({
      platform: platform as SocialPlatform,
      username: input.row.username,
      profile_url: profileUrl,
    });

    const picture = enrichment.profile_picture_url?.trim();
    if (!picture || !isUsableAvatarUrl(picture)) return null;
    if (!isAvatarUrlAllowedForPlatform(platform, picture)) return null;

    const fields = importProfilePictureAccountFields(picture, platform, "discovery");
    if (fields) {
      input.log?.(
        "info",
        `[import] avatar filled from open-graph @${input.row.username} (${platform})`
      );
    }
    return fields;
  } catch (error) {
    const message = error instanceof Error ? error.message : "open-graph fetch failed";
    input.log?.(
      "warn",
      `[import] avatar open-graph failed @${input.row.username}: ${message}`
    );
    return null;
  }
}
