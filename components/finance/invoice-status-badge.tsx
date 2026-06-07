import { Badge } from "@/components/ui/badge";
import {
  getInvoiceRegisterStatusLabel,
  isKnownInvoiceStatus,
  type InvoiceStatus,
} from "@/lib/finance/status/invoice-status";
import { STATUS_TONE_CLASS, type StatusTone } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";

const invoiceTone: Record<InvoiceStatus, StatusTone> = {
  draft: "neutral",
  sent: "info",
  partial: "warning",
  paid: "success",
  overdue: "danger",
  void: "danger",
};

function resolveInvoiceStatusTone(input: {
  status: string;
  regeneration_status?: string | null;
  label: string;
}): StatusTone {
  if (input.status === "draft" && input.regeneration_status !== undefined) {
    if (input.regeneration_status === "pending_regeneration") return "warning";
    if (input.label === "Issued") return "info";
  }

  if (isKnownInvoiceStatus(input.status)) {
    return invoiceTone[input.status];
  }

  return "neutral";
}

type InvoiceStatusBadgeProps = {
  status: string;
  regeneration_status?: string | null;
  className?: string;
};

export function InvoiceStatusBadge({
  status,
  regeneration_status,
  className,
}: InvoiceStatusBadgeProps) {
  const label =
    regeneration_status !== undefined
      ? getInvoiceRegisterStatusLabel({ status, regeneration_status })
      : isKnownInvoiceStatus(status)
        ? getInvoiceRegisterStatusLabel({ status })
        : status;
  const tone = resolveInvoiceStatusTone({ status, regeneration_status, label });

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium capitalize", STATUS_TONE_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}
