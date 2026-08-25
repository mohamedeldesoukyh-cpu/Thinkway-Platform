import {
  isQuotationOfferExpired,
  quotationIsConvertedToCampaign,
} from "@/lib/commercial/quotation-validity";
import type { QuotationStatus } from "@/types/database";

import { QUOTATION_STATUS_LABELS } from "./quotation-constants";

/** Canonical quotation status label for workspace badges and export documents. */
export function resolveQuotationStatusLabel(input: {
  status: QuotationStatus;
  validityDate?: string | null;
  isExpired?: boolean;
  campaignHeaderId?: string | null;
}): string {
  if (
    quotationIsConvertedToCampaign({
      campaignHeaderId: input.campaignHeaderId,
      status: input.status,
    })
  ) {
    return QUOTATION_STATUS_LABELS[input.status] ?? input.status;
  }

  const expired =
    input.isExpired ??
    (input.validityDate !== undefined
      ? isQuotationOfferExpired({
          validityDate: input.validityDate ?? null,
          campaignHeaderId: input.campaignHeaderId,
          status: input.status,
        })
      : false);

  if (expired && input.status === "draft") {
    return "Expired";
  }

  return QUOTATION_STATUS_LABELS[input.status] ?? input.status;
}
