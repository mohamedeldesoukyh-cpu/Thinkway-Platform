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

function campaignInvoiceStatusBadgeClass(label: string): string {
  const key = label.toLowerCase();
  if (key === "issued" || key === "sent" || key === "partial") {
    return "thinkway-campaign-badge-blue";
  }
  if (key === "paid" || key === "posted") {
    return "thinkway-campaign-badge-green";
  }
  if (key === "void" || key === "overdue" || key === "cancelled") {
    return "thinkway-campaign-badge-red";
  }
  if (key === "draft" || key === "pending regeneration") {
    return "thinkway-campaign-badge-gray";
  }
  return "thinkway-campaign-badge-gray";
}

type InvoiceStatusBadgeProps = {
  status: string;
  regeneration_status?: string | null;
  metadata?: Record<string, unknown> | null;
  className?: string;
  appearance?: "default" | "campaign";
};

export function InvoiceStatusBadge({
  status,
  regeneration_status,
  metadata,
  className,
  appearance = "default",
}: InvoiceStatusBadgeProps) {
  const label =
    regeneration_status !== undefined || metadata
      ? getInvoiceRegisterStatusLabel({ status, regeneration_status, metadata })
      : isKnownInvoiceStatus(status)
        ? getInvoiceRegisterStatusLabel({ status })
        : status;
  const tone = resolveInvoiceStatusTone({ status, regeneration_status, label });

  if (appearance === "campaign") {
    return (
      <span
        className={cn(
          "thinkway-campaign-badge",
          campaignInvoiceStatusBadgeClass(label),
          className
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <StatusBadge
      label={label}
      tone={tone}
      className={cn("text-[10px] font-medium capitalize", className)}
    />
  );
}
