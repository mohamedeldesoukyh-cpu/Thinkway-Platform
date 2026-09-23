import { createHash } from "node:crypto";
import { buildQuotationConvertUnits } from "@/lib/domains/commercial/quotation-convert-selection";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

export const APPEND_CAMPAIGN_STATUSES = ["draft", "planning", "active", "paused"];

export function quotationAppendTargetError(
  quotation: { brand_id?: unknown; client_id?: unknown },
  campaign: { brand_id?: unknown; client_id?: unknown; status?: unknown } | null,
) {
  if (!campaign) return "Campaign not found or you do not have access.";
  if (!quotation.brand_id || campaign.brand_id !== quotation.brand_id ||
      (quotation.client_id && campaign.client_id !== quotation.client_id)) {
    return "Choose a campaign for the same client and brand as the quotation.";
  }
  if (!APPEND_CAMPAIGN_STATUSES.includes(String(campaign.status))) {
    return "Completed or cancelled campaigns cannot receive new creators.";
  }
  return null;
}

/** Resolve against the whole quotation so selecting an alternative cannot make it Option 1. */
export function selectQuotationAppendUnit(items: QuotationItemRow[], itemIds: string[]) {
  if (itemIds.length !== 1) return { error: "Select exactly one creator line to add to a campaign." } as const;
  const unit = buildQuotationConvertUnits(items).find(u => u.memberItems.some(i => i.id === itemIds[0]));
  if (!unit) return { error: "Select the creator's Option 1 line." } as const;
  if (unit.kind === "package") return { error: "This creator belongs to a priced package. Separate its pricing before moving it individually." } as const;
  return { unit } as const;
}

/** Stable across quotation versions imported from the same shortlist; the PK also prevents concurrent duplicates. */
export function quotationAppendLineId(campaignId: string, item: Pick<QuotationItemRow, "id" | "source_shortlist_item_id">) {
  const hex = createHash("sha256").update(`quotation-append:${campaignId}:${item.source_shortlist_item_id || item.id}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
