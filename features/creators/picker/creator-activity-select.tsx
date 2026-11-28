"use client";
import type { CreatorActivityFilter } from "@/lib/creators/production-filter";
export function CreatorActivitySelect({ value = "active", onChange }: { value?: CreatorActivityFilter; onChange: (value: CreatorActivityFilter) => void }) {
  return <select aria-label="Creator activity" title="Active: previously enriched. Not active: never enriched." value={value} onChange={event => onChange(event.target.value as CreatorActivityFilter)} className="h-9 w-[112px] shrink-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground">
    <option value="active">Active</option><option value="inactive">Not active</option><option value="all">All</option>
  </select>;
}
