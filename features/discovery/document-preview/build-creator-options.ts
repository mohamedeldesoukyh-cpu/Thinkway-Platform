import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { platformLabel } from "@/features/campaigns/line-assignment";
import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";
import type { QuotationItemRow } from "@/features/quotations/types";
import { quotationCreatorDuplicateKey } from "@/features/quotations/export/quotation-export-utils";
import type { DocumentCreatorOption } from "./document-creator-selection-dialog";

function normalizePlatformList(platforms: Array<string | null | undefined>): string[] {
  const keys = new Set<string>();
  for (const platform of platforms) {
    const key = canonicalPlatformKey(platform ?? "");
    if (key) keys.add(key);
  }
  return sortPlatformsStable([...keys].map((platform) => ({ platform }))).map(
    (entry) => entry.platform
  );
}

function platformMeta(platforms: string[]): string | null {
  if (platforms.length === 0) return null;
  return platforms.map((platform) => platformLabel(platform)).join(" · ");
}

export function buildShortlistCreatorOptions(
  creators: ShortlistCreatorItem[]
): DocumentCreatorOption[] {
  return creators.map((item) => {
    const source = item.creator ? creatorProfileSourceFromUnified(item.creator) : null;
    const rawHandle = source?.handle?.trim() || null;
    const handle = rawHandle
      ? rawHandle.startsWith("@")
        ? rawHandle
        : `@${rawHandle}`
      : "—";
    const platforms = normalizePlatformList(
      (item.creator?.platforms ?? []).map((entry) => entry.platform)
    );
    return {
      creatorKey: item.item_id,
      itemIds: [item.item_id],
      name: source?.displayName?.trim() || handle,
      handle,
      avatarUrl: source?.avatarUrl?.trim() || null,
      platforms,
      meta: platformMeta(platforms),
    };
  });
}

export function buildQuotationCreatorOptions(
  items: QuotationItemRow[]
): DocumentCreatorOption[] {
  const byKey = new Map<string, DocumentCreatorOption>();

  for (const item of items) {
    const key = quotationCreatorDuplicateKey(item);
    const handle = item.handle?.trim()
      ? item.handle.startsWith("@")
        ? item.handle
        : `@${item.handle}`
      : "—";
    const itemPlatforms = normalizePlatformList([
      item.platform,
      ...(item.creator_profile_source?.linkedPlatforms ?? []),
    ]);
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.itemIds.includes(item.id)) {
        existing.itemIds.push(item.id);
      }
      existing.platforms = normalizePlatformList([
        ...(existing.platforms ?? []),
        ...itemPlatforms,
      ]);
      existing.meta = platformMeta(existing.platforms);
      continue;
    }
    byKey.set(key, {
      creatorKey: key,
      itemIds: [item.id],
      name: item.creator_name?.trim() || handle,
      handle,
      avatarUrl: item.profile_image_url ?? null,
      platforms: itemPlatforms,
      meta: platformMeta(itemPlatforms),
    });
  }

  return Array.from(byKey.values());
}
