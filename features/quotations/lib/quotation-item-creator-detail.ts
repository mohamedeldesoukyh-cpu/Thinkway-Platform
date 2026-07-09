import {
  getUnifiedCreatorDetailAction,
  getUnifiedCreatorsBatchAction,
} from "@/features/campaigns/creator-discovery-actions";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

type QuotationCreatorRef = Pick<
  QuotationItemRow,
  "unified_id" | "influencer_id" | "profile_id"
>;

/** Best creator lookup key for a quotation line (unified, influencer, or discovered profile). */
export function quotationItemCreatorRefId(item: QuotationCreatorRef): string | null {
  if (item.unified_id?.trim()) return item.unified_id.trim();
  if (item.influencer_id?.trim()) return item.influencer_id.trim();
  if (item.profile_id?.trim()) return `dis:${item.profile_id.trim()}`;
  return null;
}

/** Resolve a quotation line to the same unified creator record Discovery uses. */
export async function fetchQuotationItemCreatorDetail(
  item: QuotationCreatorRef
): Promise<UnifiedCreatorResult | null> {
  const unifiedId = item.unified_id?.trim();
  if (unifiedId) {
    const direct = await getUnifiedCreatorDetailAction(unifiedId);
    if (direct) return direct;
  }

  const refId = quotationItemCreatorRefId(item);
  if (!refId) return null;

  const [creator] = await getUnifiedCreatorsBatchAction([refId]);
  return creator ?? null;
}
