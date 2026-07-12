import { isQuotationExpired } from "@/lib/commercial/quotation-validity";
import type { QuotationStatus } from "@/types/database";

import { QUOTATION_STATUS_LABELS } from "./quotation-constants";

/** Canonical quotation status label for workspace badges and export documents. */
export function resolveQuotationStatusLabel(input: {
  status: QuotationStatus;
  validityDate?: string | null;
  isExpired?: boolean;
}): string {
  const expired =
    input.isExpired ??
    (input.validityDate !== undefined
      ? isQuotationExpired(input.validityDate ?? null)
      : false);

  if (expired && input.status === "draft") {
    return "Expired";
  }

  return QUOTATION_STATUS_LABELS[input.status] ?? input.status;
}
