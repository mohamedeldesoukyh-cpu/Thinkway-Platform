"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  AiField,
  AudienceField,
  CategoryField,
  CommercialField,
  EngagementField,
  FollowerRangeField,
  LocationField,
  NameField,
  PlatformField,
} from "./creator-search-filter-fields";
import { buildActiveFilterChips, type CreatorSearchFilters } from "./creator-search-types";

type Props = {
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
  onClearAll: () => void;
  onClose: () => void;
  total: number;
  loading?: boolean;
};

function FilterSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border px-4 py-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-foreground">{title}</span>
          {count > 0 ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[9px] font-bold text-primary">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? <div className="mt-3 space-y-4">{children}</div> : null}
    </section>
  );
}

export function CreatorSearchFilterPanel({
  filters,
  onChange,
  onClearAll,
  onClose,
  total,
  loading,
}: Props) {
  const set = (value: string) => (value.trim() ? 1 : 0);
  const range = (a: string, b: string) => (a || b ? 1 : 0);

  const metricsCount =
    set(filters.handle) +
    filters.platforms.length +
    range(filters.minFollowers, filters.maxFollowers) +
    set(filters.minEngagement) +
    set(filters.minViews) +
    set(filters.country) +
    set(filters.language) +
    set(filters.category) +
    set(filters.audienceInterests);

  const audienceCount =
    set(filters.audienceCountry) + set(filters.gender) + range(filters.ageMin, filters.ageMax);

  const commercialCount =
    range(filters.minEstimatedCost, filters.maxEstimatedCost) + set(filters.minBrandSafety);

  const aiCount =
    set(filters.minThinkwayScore) +
    set(filters.minBrandFit) +
    set(filters.aiNiche) +
    set(filters.minAiScore);

  const totalActive = buildActiveFilterChips(filters).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-popover">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 pr-14">
        <h2 className="text-[14px] font-semibold text-foreground">Filters</h2>
        {totalActive > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear all ({totalActive})
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <FilterSection title="Creator metrics" count={metricsCount}>
          <NameField filters={filters} onChange={onChange} />
          <PlatformField filters={filters} onChange={onChange} />
          <FollowerRangeField filters={filters} onChange={onChange} />
          <EngagementField filters={filters} onChange={onChange} />
          <LocationField filters={filters} onChange={onChange} />
          <CategoryField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="Audience data" count={audienceCount}>
          <AudienceField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="Commercial" count={commercialCount} defaultOpen={false}>
          <CommercialField filters={filters} onChange={onChange} />
        </FilterSection>

        <FilterSection title="AI scoring" count={aiCount} defaultOpen={false}>
          <AiField filters={filters} onChange={onChange} />
        </FilterSection>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <Button className="w-full" size="sm" onClick={onClose} disabled={loading}>
          {loading ? "Searching…" : `Show ${total.toLocaleString()} results`}
        </Button>
      </div>
    </div>
  );
}
