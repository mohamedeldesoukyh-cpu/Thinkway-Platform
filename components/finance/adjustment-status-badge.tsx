import { StatusBadge } from "@/components/shared/status/status-badge";
import {
  FINANCE_ADJUSTMENT_STATUS_LABELS,
  type FinanceAdjustmentStatus,
} from "@/lib/finance/status/adjustment-status";
import { ADJUSTMENT_STATUS_TONE } from "@/components/shared/status/status-config";
import { cn } from "@/lib/utils";

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
    ? ADJUSTMENT_STATUS_TONE[status as FinanceAdjustmentStatus]
    : "neutral";

  return (
    <StatusBadge
      label={label}
      tone={tone}
      className={cn("text-[10px] font-medium", className)}
    />
  );
}
