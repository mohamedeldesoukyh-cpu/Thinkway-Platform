import { quotationCreatorDuplicateKey, type QuotationCreatorRef } from "./quotation-creator-options";
import { isQuotationTemplatePhoto, type QuotationTemplatePhotos } from "./quotation-template-photos";

type PhotoItem = QuotationCreatorRef & { source_shortlist_item_id?: string | null };
type WorkspaceCreator = {
  creatorId: string;
  unifiedId?: string;
  influencerId?: string;
  profileId?: string;
  shortlistItemId?: string;
  avatarUrl?: string | null;
  quotationOptions?: Array<{ itemId: string; memberItemIds?: string[] }>;
};

/** Build aliases only from rows belonging to the authorized quotation. Never match by name/handle. */
export function quotationWorkspacePhotoAliases(items: PhotoItem[], photos: QuotationTemplatePhotos): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const item of items) {
    const photo = photos[quotationCreatorDuplicateKey(item)];
    if (!isQuotationTemplatePhoto(photo)) continue;
    aliases[`item:${item.id}`] = photo;
    if (item.unified_id) aliases[`u:${item.unified_id}`] = photo;
    if (item.influencer_id) aliases[`i:${item.influencer_id}`] = photo;
    if (item.profile_id) aliases[`p:${item.profile_id}`] = photo;
    if (item.source_shortlist_item_id) aliases[`sl:${item.source_shortlist_item_id}`] = photo;
  }
  return aliases;
}

/** Presentation only, after live profile hydration. Do not persist into review/financial snapshots. */
export function applyQuotationWorkspacePhotos<T extends WorkspaceCreator>(creators: T[], aliases?: Record<string, string>): T[] {
  if (!aliases || !Object.keys(aliases).length) return creators;
  return creators.map(creator => {
    const keys = [
      ...(creator.quotationOptions ?? []).flatMap(option => [option.itemId, ...(option.memberItemIds ?? [])].map(id => `item:${id}`)),
      ...(creator.unifiedId ? [`u:${creator.unifiedId}`] : []),
      ...(creator.influencerId ? [`i:${creator.influencerId}`] : []),
      ...(creator.profileId ? [`p:${creator.profileId}`] : []),
      ...(creator.shortlistItemId ? [`sl:${creator.shortlistItemId}`] : []),
      `item:${creator.creatorId}`, `u:${creator.creatorId}`,
      ...(creator.creatorId.startsWith("inf:") ? [`i:${creator.creatorId.slice(4)}`] : []),
      ...(creator.creatorId.startsWith("dis:") ? [`p:${creator.creatorId.slice(4)}`] : []),
      ...(creator.creatorId.startsWith("sl:") ? [creator.creatorId] : []),
    ];
    const photo = keys.map(key => aliases[key]).find(isQuotationTemplatePhoto);
    return photo ? { ...creator, avatarUrl: photo } : creator;
  });
}
