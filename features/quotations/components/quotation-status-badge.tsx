import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { QUOTATION_STATUS_LABELS } from "@/features/quotations/constants";
import type { QuotationStatus } from "@/types/database";

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <StatusBadge
      label={QUOTATION_STATUS_LABELS[status]}
      tone={resolveStatusTone("quotation", status)}
      appearance="ghost"
    />
  );
}
