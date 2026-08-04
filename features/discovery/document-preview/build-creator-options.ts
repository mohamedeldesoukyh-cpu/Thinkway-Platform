import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";
import type { QuotationItemRow } from "@/features/quotations/types";
import { quotationCreatorDuplicateKey } from "@/features/quotations/export/quotation-export-utils";
import type { DocumentCreatorOption } from "./document-creator-selection-dialog";

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
    const platform =
      item.creator?.platforms?.find((entry) => entry.platform)?.platform ?? null;
    return {
      creatorKey: item.item_id,
      itemIds: [item.item_id],
      name: source?.displayName?.trim() || handle,
      handle,
      avatarUrl: source?.avatarUrl?.trim() || null,
      meta: platform ? String(platform) : null,
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
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.itemIds.includes(item.id)) {
        existing.itemIds.push(item.id);
      }
      continue;
    }
    byKey.set(key, {
      creatorKey: key,
      itemIds: [item.id],
      name: item.creator_name?.trim() || handle,
      handle,
      avatarUrl: item.profile_image_url ?? null,
      meta: item.platform ? String(item.platform) : null,
    });
  }

  return Array.from(byKey.values());
}
