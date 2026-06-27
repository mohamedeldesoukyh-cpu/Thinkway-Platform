import { formatPaymentTermsLabel } from "@/lib/vendors/format-utils";
import type { PaymentTerms } from "@/types/database";

export function resolveVendorIoPaymentSchedule(options: {
  specialPaymentTerms: string | null | undefined;
  vendorPaymentTerms: PaymentTerms | string | null | undefined;
}): string {
  const special = options.specialPaymentTerms?.trim();
  if (special) {
    return special;
  }

  return formatPaymentTermsLabel(options.vendorPaymentTerms as PaymentTerms | null | undefined);
}
