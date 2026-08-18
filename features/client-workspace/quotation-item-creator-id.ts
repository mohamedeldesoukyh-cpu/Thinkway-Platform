import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

/** Same creator id written into `campaign_client_reviews.selection_state` for quotation reviews. */
export function quotationItemClientCreatorId(
  item: Pick<QuotationItemRow, "id" | "unified_id" | "influencer_id" | "profile_id">
): string {
  if (item.unified_id?.trim()) return item.unified_id.trim();
  if (item.influencer_id?.trim()) return `inf:${item.influencer_id.trim()}`;
  if (item.profile_id?.trim()) return `dis:${item.profile_id.trim()}`;
  return item.id;
}
