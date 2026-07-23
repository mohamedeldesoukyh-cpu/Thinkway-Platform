import type {
  QuotationDocCreatorGroup,
  QuotationDocCollapsePackageCreator,
  QuotationDocPublicationShot,
  QuotationDocument,
} from "./quotation-document";

export const SHOWCASE_COLLAP_MIX_FEED_LIMIT = 6;

export function normalizeExportHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

export function resolveCreatorGroupForCollapseCreator(
  doc: QuotationDocument,
  creator: QuotationDocCollapsePackageCreator
): QuotationDocCreatorGroup | undefined {
  const handleKey = normalizeExportHandle(creator.handle);
  return doc.creatorGroups.find((group) => {
    if (handleKey && handleKey !== "—") {
      if (normalizeExportHandle(group.handle) === handleKey) return true;
    }
    return group.creator.trim() === creator.creator.trim();
  });
}

/** Round-robin interleave publication shots from multiple creators (mix feed). */
export function interleavePublicationShots(
  shotLists: QuotationDocPublicationShot[][],
  limit = SHOWCASE_COLLAP_MIX_FEED_LIMIT
): QuotationDocPublicationShot[] {
  const nonEmpty = shotLists.filter((list) => list.length > 0);
  if (!nonEmpty.length) return [];

  const merged: QuotationDocPublicationShot[] = [];
  const seen = new Set<string>();
  let index = 0;

  while (merged.length < limit) {
    let added = false;
    for (const list of nonEmpty) {
      if (merged.length >= limit) break;
      const shot = list[index];
      if (!shot) continue;
      const dedupeKey = shot.imageUrl?.trim() || shot.postUrl?.trim() || "";
      if (dedupeKey && seen.has(dedupeKey)) continue;
      if (dedupeKey) seen.add(dedupeKey);
      merged.push(shot);
      added = true;
    }
    if (!added) break;
    index += 1;
  }

  return merged;
}

export function buildCollapsePackageMixFeed(
  doc: QuotationDocument,
  creators: QuotationDocCollapsePackageCreator[],
  limit = SHOWCASE_COLLAP_MIX_FEED_LIMIT
): QuotationDocPublicationShot[] {
  const shotLists = creators
    .map((creator) => resolveCreatorGroupForCollapseCreator(doc, creator)?.publicationShots ?? [])
    .filter((shots) => shots.length > 0);
  return interleavePublicationShots(shotLists, limit);
}
