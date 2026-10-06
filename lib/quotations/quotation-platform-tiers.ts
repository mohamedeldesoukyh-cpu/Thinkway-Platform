import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { CreatorPlatformTierAccount } from "@/lib/creators/creator-tier";

export function quotationPlatformTierAccounts(
  item: Pick<QuotationItemRow, "creator_profile_source" | "platform" | "handle" | "followers">
): CreatorPlatformTierAccount[] {
  if (item.creator_profile_source?.platformAccounts?.length) {
    return item.creator_profile_source.platformAccounts;
  }
  // Legacy/manual lines can provide one platform's count. A combined line count
  // must not be stamped onto every linked platform.
  const linePlatforms = (item.platform ?? "").split(/[,|/]/).map((p) => canonicalPlatformKey(p.trim())).filter(Boolean);
  const linked = item.creator_profile_source?.linkedPlatforms?.length
    ? item.creator_profile_source.linkedPlatforms.map(canonicalPlatformKey)
    : linePlatforms;
  return [...new Set(linked)].map((platform) => ({
    platform,
    handle: linePlatforms.length === 1 && linePlatforms[0] === platform ? item.handle : null,
    followers: linePlatforms.length === 1 && linePlatforms[0] === platform ? item.followers : null,
  }));
}
