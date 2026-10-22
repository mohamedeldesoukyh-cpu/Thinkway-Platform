import type { QuotationDocument } from "./quotation-document";
import { orderCreatorGroups } from "@/lib/quotations/quotation-creator-order";
import { compareClientListCreators } from "@/lib/creators/client-list-order";

export function orderedQuotationReportCreators(doc: QuotationDocument) {
  return orderCreatorGroups([...doc.creatorGroups].sort((a,b) => compareClientListCreators(
    {tier:a.highestPlatformTier ?? a.rows[0]?.tier,followers:a.highestPlatformFollowers},
    {tier:b.highestPlatformTier ?? b.rows[0]?.tier,followers:b.highestPlatformFollowers}
  ) || a.creator.localeCompare(b.creator)),doc.creatorListOrder,group=>group.itemIds ?? []);
}
