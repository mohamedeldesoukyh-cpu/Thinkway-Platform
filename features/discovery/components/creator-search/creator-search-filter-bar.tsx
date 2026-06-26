"use client";

import {
  ChevronDownIcon,
  SlidersHorizontalIcon,
  UsersIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  AudienceField,
  CategoryField,
  EngagementField,
  FollowerRangeField,
  LocationField,
  PlatformField,
} from "./creator-search-filter-fields";
import { buildActiveFilterChips, type CreatorSearchFilters } from "./creator-search-types";

type Props = {
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
  onOpenAllFilters: () => void;
};

type FilterPillDef = {
  id: string;
  label: string;
  count: number;
  Field: ComponentType<{
    filters: CreatorSearchFilters;
    onChange: (next: CreatorSearchFilters) => void;
  }>;
};

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
      {count}
    </span>
  );
}

function FilterPill({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  const active = count > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors",
            active
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50"
          )}
        >
          {label}
          <CountBadge count={count} />
          <ChevronDownIcon className="size-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3.5">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function CreatorSearchFilterBar({ filters, onChange, onOpenAllFilters }: Props) {
  const totalActive = buildActiveFilterChips(filters).length;

  const range = (a: string, b: string) => (a || b ? 1 : 0);
  const set = (value: string) => (value.trim() ? 1 : 0);

  const pills: FilterPillDef[] = [
    { id: "platform", label: "Platform", count: filters.platforms.length, Field: PlatformField },
    {
      id: "followers",
      label: "Followers",
      count: range(filters.minFollowers, filters.maxFollowers),
      Field: FollowerRangeField,
    },
    {
      id: "engagement",
      label: "Engagement",
      count: set(filters.minEngagement) + set(filters.minViews),
      Field: EngagementField,
    },
    {
      id: "location",
      label: "Location",
      count: set(filters.country) + set(filters.language),
      Field: LocationField,
    },
    {
      id: "categories",
      label: "Categories",
      count: set(filters.category) + set(filters.audienceInterests),
      Field: CategoryField,
    },
  ];

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-2 md:px-5">
      {/* Mobile: single Filters button */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5 text-xs md:hidden"
        onClick={onOpenAllFilters}
      >
        <SlidersHorizontalIcon className="size-3.5" />
        Filters
        <CountBadge count={totalActive} />
      </Button>

      {/* Desktop: per-filter popover pills */}
      <div className="hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pills.map((pill) => (
          <FilterPill key={pill.id} label={pill.label} count={pill.count}>
            <pill.Field filters={filters} onChange={onChange} />
          </FilterPill>
        ))}

        <FilterPill
          label="Audience"
          count={
            set(filters.audienceCountry) +
            set(filters.gender) +
            (filters.ageMin || filters.ageMax ? 1 : 0)
          }
        >
          <AudienceField filters={filters} onChange={onChange} />
        </FilterPill>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="ml-auto hidden h-8 shrink-0 gap-1.5 text-xs md:inline-flex"
        onClick={onOpenAllFilters}
      >
        <UsersIcon className="size-3.5" />
        All filters
        <CountBadge count={totalActive} />
      </Button>
    </div>
  );
}
