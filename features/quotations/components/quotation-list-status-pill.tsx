import { cn } from "@/lib/utils";
import type { QuotationStatus } from "@/types/database";

import { QUOTATION_STATUS_LABELS } from "../constants";

export function QuotationListStatusPill({
  status,
  className,
}: {
  status: QuotationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[23px] items-center rounded-[7px] bg-muted/50 px-2.5 text-[11.5px] font-semibold text-[var(--text-2)] dark:bg-muted/30",
        className
      )}
    >
      {QUOTATION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function QuotationWorkspaceStatusPill({
  status,
  isExpired,
  className,
}: {
  status: QuotationStatus;
  isExpired?: boolean;
  className?: string;
}) {
  const spill = className?.includes("spill");

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 text-[11.5px] font-semibold",
        spill
          ? "spill rounded-[7px] px-2.5 text-[var(--text-2)]"
          : "rounded-[7px] bg-muted/50 px-2.5 text-[var(--text-2)] dark:bg-muted/30",
        isExpired && !spill && "bg-red-500/10 text-red-700 dark:text-red-400",
        isExpired && spill && "bg-red-500/10 text-red-700 dark:text-red-400",
        className
      )}
    >
      <span
        className={cn(
          spill ? "led size-1.5 shrink-0 rounded-full" : "size-1.5 shrink-0 rounded-full bg-muted-foreground/70",
          !spill && status === "draft" && "bg-slate-400",
          !spill && status === "under_review" && "bg-amber-500",
          !spill && status === "sent" && "bg-blue-500",
          !spill && status === "approved" && "bg-emerald-500",
          isExpired && "bg-red-500"
        )}
        aria-hidden
      />
      {isExpired ? "Expired" : (QUOTATION_STATUS_LABELS[status] ?? status)}
    </span>
  );
}
