"use client";
import type { CreatorActivityFilter } from "@/lib/creators/production-filter";
export function CreatorActivitySelect({ value = "active", onChange }: { value?: CreatorActivityFilter; onChange: (value: CreatorActivityFilter) => void }) {
  return <div role="group" aria-label="Creator activity" className="creator-activity-segments" title="Active: enriched with usable metrics. Not active: never enriched or no usable metrics.">
    {([['active', 'Active'], ['inactive', 'Not active'], ['all', 'All']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{label}</button>)}
  </div>;
}
