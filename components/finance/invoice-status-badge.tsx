import { Badge } from "@/components/ui/badge";
import {
  isKnownInvoiceStatus,
  type InvoiceStatus,
} from "@/lib/finance/status/invoice-status";
import { STATUS_TONE_CLASS, type StatusTone } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

const invoiceTone: Record<InvoiceStatus, StatusTone> = {
  draft: "neutral",
  sent: "info",
  partial: "warning",
  paid: "success",
  overdue: "danger",
  void: "danger",
};

type InvoiceStatusBadgeProps = {
  status: string;
  className?: string;
};

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const known = isKnownInvoiceStatus(status);
  const label = known ? INVOICE_STATUS_LABELS[status] : status;
  const tone = known ? invoiceTone[status] : "neutral";

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium capitalize", STATUS_TONE_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}
