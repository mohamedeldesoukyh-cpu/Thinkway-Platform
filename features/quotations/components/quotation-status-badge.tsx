import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { resolveQuotationStatusLabel } from "@/features/quotations/constants";
import type { QuotationStatus } from "@/types/database";

export function QuotationStatusBadge({
  status,
  className,
  validityDate,
  isExpired,
}: {
  status: QuotationStatus;
  className?: string;
  validityDate?: string | null;
  isExpired?: boolean;
}) {
  return (
    <StatusBadge
      label={resolveQuotationStatusLabel({ status, validityDate, isExpired })}
      tone={resolveStatusTone("quotation", status)}
      appearance="ghost"
      className={className}
    />
  );
}
