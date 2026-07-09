import {
  creatorProfileSourceFromPlatformAccount,
  type CreatorProfileSource,
} from "@/lib/creators/creator-profile-source";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import { formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

function resolveItemProfileUrl(item: QuotationItemRow): string | null {
  if (item.profile_url?.trim()) return item.profile_url.trim();
  if (!item.platform) return null;
  return resolveCreatorProfileUrl({
    platform: item.platform,
    handle: item.handle,
  });
}

function resolveItemCountryCode(item: QuotationItemRow): string | null {
  return normalizeCountryCode(item.country_code);
}

/** Fill gaps from quotation line snapshot without overriding enriched unified fields. */
export function mergeQuotationItemIntoProfileSource(
  source: CreatorProfileSource,
  item: QuotationItemRow
): CreatorProfileSource {
  const profileUrl =
    source.profile_url?.trim() ||
    resolveItemProfileUrl(item) ||
    null;

  return {
    ...source,
    displayName:
      source.displayName?.trim() ||
      formatCreatorDisplayName(item.creator_name) ||
      formatCreatorDisplayName(item.handle) ||
      "Creator",
    avatarUrl: source.avatarUrl ?? item.profile_image_url ?? null,
    handle: source.handle?.trim() || item.handle?.trim() || null,
    profile_url: profileUrl,
    countryCode: source.countryCode ?? resolveItemCountryCode(item) ?? null,
    isVerified: source.isVerified,
  };
}

export function buildQuotationCreatorProfileSource(item: QuotationItemRow) {
  if (item.creator_profile_source) {
    return mergeQuotationItemIntoProfileSource(item.creator_profile_source, item);
  }

  const profileUrl = resolveItemProfileUrl(item);
  const platformAccount =
    item.platform != null
      ? {
          platform: item.platform,
          handle: item.handle ?? "",
          profile_url: profileUrl,
          profile_picture_url: item.profile_image_url,
        }
      : item.handle
        ? {
            platform: "",
            handle: item.handle,
            profile_url: profileUrl,
            profile_picture_url: item.profile_image_url,
          }
        : null;

  const source = creatorProfileSourceFromPlatformAccount(
    item.creator_name ?? item.handle ?? "Creator",
    platformAccount,
    {
      avatarUrl: item.profile_image_url,
    }
  );

  return mergeQuotationItemIntoProfileSource(source, item);
}

/** Profile source for quotation creator rows — merges item enrichment with platform linkage. */
export function resolveQuotationCreatorProfileSource(
  item: QuotationItemRow,
  linkedPlatforms: string[]
): CreatorProfileSource {
  const base = buildQuotationCreatorProfileSource(item);
  if (linkedPlatforms.length <= 1) {
    return mergeQuotationItemIntoProfileSource(
      {
        ...base,
        platform: base.platform ?? linkedPlatforms[0] ?? item.platform ?? null,
        linkedPlatforms: linkedPlatforms.length ? linkedPlatforms : base.linkedPlatforms,
      },
      item
    );
  }
  return mergeQuotationItemIntoProfileSource(
    { ...base, platform: null, linkedPlatforms },
    item
  );
}

/** Browser-ready proxied avatar src for quotation rows. */
export function quotationItemAvatarDisplayUrl(item: QuotationItemRow): string | null {
  const profileUrl = resolveItemProfileUrl(item);
  return creatorAvatarBrowserDisplayUrl(item.profile_image_url, profileUrl);
}
