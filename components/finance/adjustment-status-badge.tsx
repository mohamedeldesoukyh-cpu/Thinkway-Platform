import { Badge } from "@/components/ui/badge";
import {
  FINANCE_ADJUSTMENT_STATUS_LABELS,
  type FinanceAdjustmentStatus,
} from "@/lib/finance/status/adjustment-status";
import { STATUS_TONE_CLASS, type StatusTone } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";

const adjustmentTone: Record<FinanceAdjustmentStatus, StatusTone> = {
  draft: "neutral",
  approved: "info",
  posted: "success",
  cancelled: "danger",
  void: "danger",
  pending_repost: "warning",
};

type AdjustmentStatusBadgeProps = {
  status: FinanceAdjustmentStatus | string;
  className?: string;
};

export function AdjustmentStatusBadge({ status, className }: AdjustmentStatusBadgeProps) {
  const known = status in FINANCE_ADJUSTMENT_STATUS_LABELS;
  const label = known
    ? FINANCE_ADJUSTMENT_STATUS_LABELS[status as FinanceAdjustmentStatus]
    : status;
  const tone = known
    ? adjustmentTone[status as FinanceAdjustmentStatus]
    : "neutral";

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", STATUS_TONE_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}
