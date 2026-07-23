import {
  creatorProfileSourceFromPlatformAccount,
  type CreatorProfileSource,
} from "@/lib/creators/creator-profile-source";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import {
  creatorAvatarBrowserDisplayUrl,
  normalizeThinkwayStoredAvatarUrl,
} from "@/lib/performance/creator-avatar";
import {
  isUsableAvatarUrl,
  isDisplayableAvatarUrl,
} from "@/lib/performance/avatar-sync-policy";
import { isDurableStoredAvatarUrl } from "@/lib/creators/dna-avatar";
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

/** Normalize countryCode + countryCodes so empty [] never hides a known ISO code. */
function resolveProfileCountryFields(
  source: Pick<CreatorProfileSource, "countryCode" | "countryCodes">,
  item: QuotationItemRow
): Pick<CreatorProfileSource, "countryCode" | "countryCodes"> {
  const countryCodes = resolveCreatorCountryCodes({
    country_codes: source.countryCodes,
    country_code: source.countryCode ?? resolveItemCountryCode(item),
  });
  return {
    countryCode: countryCodes[0] ?? null,
    countryCodes: countryCodes.length > 0 ? countryCodes : null,
  };
}

/** Keep any displayable avatar — matches shortlist / unified browse display rules. */
function normalizeQuotationAvatarCandidate(
  url: string | null | undefined
): string | null {
  const normalized = normalizeThinkwayStoredAvatarUrl(url);
  if (!normalized || !isDisplayableAvatarUrl(normalized)) return null;
  return normalized;
}

/** Resolve avatar from server-enriched fields first (same priority as shortlist list previews). */
function resolveQuotationAvatarFromItem(item: QuotationItemRow): string | null {
  return (
    normalizeQuotationAvatarCandidate(item.creator_profile_source?.avatarUrl) ??
    normalizeQuotationAvatarCandidate(item.profile_image_url) ??
    null
  );
}

function resolveQuotationDisplayAvatarUrl(
  source: CreatorProfileSource,
  item: QuotationItemRow
): string | null {
  const fromSource = normalizeQuotationAvatarCandidate(source.avatarUrl);
  if (fromSource) return fromSource;

  const fromEnriched = normalizeQuotationAvatarCandidate(item.creator_profile_source?.avatarUrl);
  if (fromEnriched) return fromEnriched;

  return quotationItemSnapshotAvatar(item);
}

function quotationItemSnapshotAvatar(item: QuotationItemRow): string | null {
  const url = normalizeThinkwayStoredAvatarUrl(item.profile_image_url);
  if (!url) return null;
  if (isDurableStoredAvatarUrl(url) || isUsableAvatarUrl(url)) return url;
  return null;
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
    avatarUrl: resolveQuotationDisplayAvatarUrl(source, item),
    handle: source.handle?.trim() || item.handle?.trim() || null,
    profile_url: profileUrl,
    ...resolveProfileCountryFields(source, item),
    isVerified: source.isVerified,
  };
}

export function buildQuotationCreatorProfileSource(item: QuotationItemRow) {
  if (item.creator_profile_source) {
    const enriched = item.creator_profile_source;
    const avatarUrl = resolveQuotationAvatarFromItem(item) ?? enriched.avatarUrl ?? null;
    return {
      ...enriched,
      displayName:
        enriched.displayName?.trim() ||
        formatCreatorDisplayName(item.creator_name) ||
        formatCreatorDisplayName(item.handle) ||
        "Creator",
      avatarUrl,
      handle: enriched.handle?.trim() || item.handle?.trim() || null,
      profile_url:
        enriched.profile_url?.trim() || resolveItemProfileUrl(item) || null,
      ...resolveProfileCountryFields(enriched, item),
    };
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
      avatarUrl: quotationItemSnapshotAvatar(item) ?? item.profile_image_url,
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
    return {
      ...base,
      platform: base.platform ?? linkedPlatforms[0] ?? item.platform ?? null,
      linkedPlatforms: linkedPlatforms.length ? linkedPlatforms : base.linkedPlatforms,
    };
  }
  return {
    ...base,
    platform: null,
    linkedPlatforms,
  };
}

/** Browser-ready proxied avatar src for quotation rows. */
export function quotationItemAvatarDisplayUrl(item: QuotationItemRow): string | null {
  const profileUrl = resolveItemProfileUrl(item);
  const avatarUrl = resolveQuotationAvatarFromItem(item);
  return creatorAvatarBrowserDisplayUrl(avatarUrl, profileUrl);
}
