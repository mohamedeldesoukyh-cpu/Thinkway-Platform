import { StatusBadge } from "@/components/shared/status/status-badge";
import {
  POSTING_BATCH_STATUS_LABELS,
  type FinancePostingBatchStatus,
} from "@/lib/finance/status/posting-status";
import { POSTING_BATCH_STATUS_TONE } from "@/components/shared/status/status-config";
import { cn } from "@/lib/utils";

type PostingBatchStatusBadgeProps = {
  status: FinancePostingBatchStatus | string;
  className?: string;
};

export function PostingBatchStatusBadge({ status, className }: PostingBatchStatusBadgeProps) {
  const known = status in POSTING_BATCH_STATUS_LABELS;
  const label = known
    ? POSTING_BATCH_STATUS_LABELS[status as FinancePostingBatchStatus]
    : status;
  const tone = known ? POSTING_BATCH_STATUS_TONE[status as FinancePostingBatchStatus] : "neutral";

  return (
    <StatusBadge
      label={label}
      tone={tone}
      className={cn("text-[10px] font-medium", className)}
    />
  );
}
