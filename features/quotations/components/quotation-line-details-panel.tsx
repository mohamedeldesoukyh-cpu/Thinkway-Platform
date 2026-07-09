import { formatQuotationDeliverablesSummary } from "@/lib/quotations/quotation-deliverable-types";
import type { QuotationItemRow } from "@/features/quotations/types";

export function quotationLineSummary(item: QuotationItemRow): string {
  return formatQuotationDeliverablesSummary(item.deliverables, item.service_description);
}
