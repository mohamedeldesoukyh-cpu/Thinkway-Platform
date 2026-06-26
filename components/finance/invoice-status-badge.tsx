import { StatusBadge } from "@/components/shared/status/status-badge";
import {
  getInvoiceRegisterStatusLabel,
  isKnownInvoiceStatus,
  type InvoiceStatus,
} from "@/lib/finance/status/invoice-status";
import { INVOICE_STATUS_TONE } from "@/components/shared/status/status-config";
import type { SemanticStatusTone } from "@/components/shared/status/status-config";
import { cn } from "@/lib/utils";

function resolveInvoiceStatusTone(input: {
  status: string;
  regeneration_status?: string | null;
  label: string;
}): SemanticStatusTone {
  if (input.status === "draft" && input.regeneration_status !== undefined) {
    if (input.regeneration_status === "pending_regeneration") return "warning";
    if (input.label === "Issued") return "foreground";
  }

  if (isKnownInvoiceStatus(input.status)) {
    return INVOICE_STATUS_TONE[input.status as InvoiceStatus];
  }

  return "neutral";
}

type InvoiceStatusBadgeProps = {
  status: string;
  regeneration_status?: string | null;
  metadata?: Record<string, unknown> | null;
  className?: string;
};

export function InvoiceStatusBadge({
  status,
  regeneration_status,
  metadata,
  className,
}: InvoiceStatusBadgeProps) {
  const label =
    regeneration_status !== undefined || metadata
      ? getInvoiceRegisterStatusLabel({ status, regeneration_status, metadata })
      : isKnownInvoiceStatus(status)
        ? getInvoiceRegisterStatusLabel({ status })
        : status;
  const tone = resolveInvoiceStatusTone({ status, regeneration_status, label });

  return (
    <StatusBadge
      label={label}
      tone={tone}
      className={cn("text-[10px] font-medium capitalize", className)}
    />
  );
}
