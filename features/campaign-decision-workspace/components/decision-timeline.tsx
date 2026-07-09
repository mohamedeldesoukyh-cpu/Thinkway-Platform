"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { DecisionTimelineEntry } from "../types";

type DecisionTimelineProps = {
  entries: DecisionTimelineEntry[];
  bare?: boolean;
  className?: string;
};

function TimelineContent({ entries }: { entries: DecisionTimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No decisions recorded yet</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.slice(0, 8).map((entry) => (
        <li key={entry.id} className="relative border-l-2 border-[#1D9E75]/30 pl-3">
          <p className="text-xs font-medium">{entry.scenarioName}</p>
          <p className="text-[10px] text-muted-foreground">
            {entry.action} · {entry.createdBy} · {new Date(entry.createdAt).toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px]">{entry.changesSummary}</p>
          {entry.reason && (
            <p className="text-[10px] text-muted-foreground">Reason: {entry.reason}</p>
          )}
          {entry.recommendation && (
            <p className="text-[10px] text-[#1D9E75]">→ {entry.recommendation}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function DecisionTimeline({ entries, bare = false, className }: DecisionTimelineProps) {
  if (bare) {
    return (
      <div className={className}>
        <TimelineContent entries={entries} />
      </div>
    );
  }

  return (
    <Card size="sm" className={cn("rounded-2xl border-border/80 shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Decision Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <TimelineContent entries={entries} />
      </CardContent>
    </Card>
  );
}
