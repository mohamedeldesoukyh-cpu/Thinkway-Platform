"use client";

import { format } from "date-fns";

import type { FinanceAuditTimelineEntry } from "@/lib/finance/queries/finance-audit";
import { cn } from "@/lib/utils";

type FinanceAuditTimelineProps = {
  entries: FinanceAuditTimelineEntry[];
  className?: string;
  emptyMessage?: string;
};

export function FinanceAuditTimeline({
  entries,
  className,
  emptyMessage = "No finance audit events yet.",
}: FinanceAuditTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex items-start justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{entry.label}</p>
            <p className="text-xs text-muted-foreground">
              {entry.actor_name ?? "System"}
              {entry.payload.document_number ? (
                <span className="ml-1 font-mono">· {String(entry.payload.document_number)}</span>
              ) : null}
            </p>
          </div>
          <time className="shrink-0 text-xs text-muted-foreground">
            {format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}
          </time>
        </li>
      ))}
    </ul>
  );
}
