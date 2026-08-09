import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { platformLabel } from "@/features/campaigns/line-assignment";
import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";
import type { QuotationItemRow } from "@/features/quotations/types";
import { quotationCreatorDuplicateKey } from "@/features/quotations/export/quotation-export-utils";
import {
  loadCreatorPlatformOptions,
  unionQuotationCreatorGroupPlatforms,
} from "@/lib/quotations/quotation-creator-platform-options";
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
  const itemsByKey = new Map<string, QuotationItemRow[]>();

  for (const item of items) {
    const key = quotationCreatorDuplicateKey(item);
    const group = itemsByKey.get(key) ?? [];
    group.push(item);
    itemsByKey.set(key, group);
  }

  for (const [key, groupItems] of itemsByKey) {
    const item = groupItems[0]!;
    const handle = item.handle?.trim()
      ? item.handle.startsWith("@")
        ? item.handle
        : `@${item.handle}`
      : "—";
    const platforms = unionQuotationCreatorGroupPlatforms(groupItems);
    byKey.set(key, {
      creatorKey: key,
      itemIds: groupItems.map((row) => row.id),
      name: item.creator_name?.trim() || handle,
      handle,
      avatarUrl: item.profile_image_url ?? null,
      platforms,
      meta: platformMeta(platforms),
    });
  }

  return Array.from(byKey.values());
}

/**
 * Load linked platform accounts (same source as quotation creator headers)
 * so Preview/Export can offer every network, not only deliverable platforms.
 */
export async function enrichQuotationCreatorOptionsWithLinkedPlatforms(
  items: QuotationItemRow[],
  options: DocumentCreatorOption[]
): Promise<DocumentCreatorOption[]> {
  if (options.length === 0) return options;

  return Promise.all(
    options.map(async (option) => {
      const groupItems = items.filter((item) => option.itemIds.includes(item.id));
      const sample = groupItems[0];
      if (!sample) return option;

      const fetched = await loadCreatorPlatformOptions(sample);
      const platforms = unionQuotationCreatorGroupPlatforms(
        groupItems,
        fetched.map((entry) => entry.platform)
      );
      if (
        platforms.length === (option.platforms?.length ?? 0) &&
        platforms.every((platform) => option.platforms?.includes(platform))
      ) {
        return option;
      }
      return {
        ...option,
        platforms,
        meta: platformMeta(platforms),
      };
    })
  );
}
