import { Badge } from "@/components/ui/badge";
import {
  POSTING_BATCH_STATUS_LABELS,
  type FinancePostingBatchStatus,
} from "@/lib/finance/status/posting-status";
import { STATUS_TONE_CLASS, type StatusTone } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";

const postingTone: Record<FinancePostingBatchStatus, StatusTone> = {
  draft: "neutral",
  posted: "success",
  reversed: "warning",
  failed: "danger",
};

type PostingBatchStatusBadgeProps = {
  status: FinancePostingBatchStatus | string;
  className?: string;
};

export function PostingBatchStatusBadge({ status, className }: PostingBatchStatusBadgeProps) {
  const known = status in POSTING_BATCH_STATUS_LABELS;
  const label = known
    ? POSTING_BATCH_STATUS_LABELS[status as FinancePostingBatchStatus]
    : status;
  const tone = known ? postingTone[status as FinancePostingBatchStatus] : "neutral";

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", STATUS_TONE_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}
