import {
  labelForOption,
  PAYMENT_TERMS_OPTIONS,
  VENDOR_PAYMENT_METHOD_OPTIONS,
} from "@/lib/master-data/constants";
import type { PaymentTerms } from "@/types/database";

export function formatPaymentTermsLabel(
  paymentTerms: PaymentTerms | null | undefined
): string {
  if (!paymentTerms) {
    return "Net 30 Days from Invoice";
  }
  return (
    labelForOption(PAYMENT_TERMS_OPTIONS, paymentTerms) ??
    paymentTerms.replace(/_/g, " ")
  );
}

export function formatPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) {
    return "Bank transfer";
  }
  return (
    labelForOption(VENDOR_PAYMENT_METHOD_OPTIONS, method) ??
    method.replace(/_/g, " ")
  );
}

