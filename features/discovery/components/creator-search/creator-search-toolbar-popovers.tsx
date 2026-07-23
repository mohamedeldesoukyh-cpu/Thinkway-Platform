"use client";

import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowUpIcon,
  ListFilterIcon,
  UsersRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { FollowerRangeField, PlatformField } from "./creator-search-filter-fields";
import {
  DISCOVERY_TOOLBAR_ICON_PROPS,
  DiscoveryToolbarActiveBadge,
  discoveryToolbarBtnClass,
} from "./creator-search-toolbar-utils";
import {
  CREATOR_SEARCH_SORT_FIELDS,
  buildActiveFilterChips,
  defaultDirectionForSortField,
  type CreatorSearchFilters,
  type CreatorSearchSortDirection,
  type CreatorSearchSortField,
  type CreatorSearchSortState,
} from "./creator-search-types";

type FiltersPopoverProps = {
  filters: CreatorSearchFilters;
  onChange: (filters: CreatorSearchFilters) => void;
  onOpenAllFilters: () => void;
};

/** Filter icon → platforms + shortcut to full filter drawer. */
export function CreatorSearchFiltersPopover({
  filters,
  onChange,
  onOpenAllFilters,
}: FiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const activeCount = buildActiveFilterChips(filters, "").length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : undefined}>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : "Filters"}
              className={discoveryToolbarBtnClass(activeCount > 0)}
            >
              <ListFilterIcon {...DISCOVERY_TOOLBAR_ICON_PROPS} />
              {activeCount > 0 ? <DiscoveryToolbarActiveBadge /> : null}
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="bottom">Filters</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-[min(320px,calc(100vw-1.5rem))] space-y-3 p-3"
      >
        <div className="text-[12px] font-semibold text-foreground">Filters</div>
        <PlatformField filters={filters} onChange={onChange} />
        <div className="border-t border-border/60 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => {
              setOpen(false);
              onOpenAllFilters();
            }}
          >
            All filters
            {activeCount > 0 ? (
              <span className="ml-1.5 flex size-4 items-center justify-center rounded-full bg-[#2563eb] text-[9px] font-bold text-white">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type FollowersPopoverProps = {
  filters: CreatorSearchFilters;
  onChange: (filters: CreatorSearchFilters) => void;
};

/** Followers icon → follower range presets / custom min–max. */
export function CreatorSearchFollowersPopover({
  filters,
  onChange,
}: FollowersPopoverProps) {
  const [open, setOpen] = useState(false);
  const active = Boolean(filters.minFollowers || filters.maxFollowers);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : undefined}>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={active ? "Follower range (active)" : "Follower range"}
              className={discoveryToolbarBtnClass(active)}
            >
              <UsersRoundIcon {...DISCOVERY_TOOLBAR_ICON_PROPS} />
              {active ? <DiscoveryToolbarActiveBadge /> : null}
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="bottom">Followers</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-[min(320px,calc(100vw-1.5rem))] space-y-2 p-3"
      >
        <div className="text-[12px] font-semibold text-foreground">Followers</div>
        <FollowerRangeField filters={filters} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

type SortPopoverProps = {
  sort: CreatorSearchSortState;
  onSortChange: (value: CreatorSearchSortState) => void;
  showCampaignRelevance?: boolean;
};

/** Sort icon → sort field + direction. */
export function CreatorSearchSortPopover({
  sort,
  onSortChange,
  showCampaignRelevance = false,
}: SortPopoverProps) {
  const [open, setOpen] = useState(false);
  const sortOptions = showCampaignRelevance
    ? CREATOR_SEARCH_SORT_FIELDS
    : CREATOR_SEARCH_SORT_FIELDS.filter((option) => option.value !== "relevance");
  const currentLabel =
    sortOptions.find((option) => option.value === sort.field)?.label ?? "Sort";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : undefined}>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Sort by ${currentLabel}`}
              className={discoveryToolbarBtnClass()}
            >
              <ArrowDownUpIcon {...DISCOVERY_TOOLBAR_ICON_PROPS} />
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="bottom">Sort</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-[min(240px,calc(100vw-1.5rem))] space-y-2 p-2"
      >
        <div className="px-1.5 pt-0.5 text-[12px] font-semibold text-foreground">
          Sort by
        </div>
        <div className="flex flex-col gap-0.5">
          {sortOptions.map((option) => {
            const selected = sort.field === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px]",
                  selected
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground hover:bg-muted/70"
                )}
                onClick={() =>
                  onSortChange({
                    field: option.value as CreatorSearchSortField,
                    direction: selected
                      ? sort.direction
                      : defaultDirectionForSortField(option.value as CreatorSearchSortField),
                  })
                }
              >
                <span>{option.label}</span>
                {selected ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {sort.direction}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 border-t border-border/60 pt-2">
          {(
            [
              { value: "asc" as const, icon: ArrowUpIcon, label: "Asc" },
              { value: "desc" as const, icon: ArrowDownIcon, label: "Desc" },
            ] as const
          ).map(({ value, icon: Icon, label }) => (
            <Button
              key={value}
              type="button"
              variant={sort.direction === value ? "default" : "outline"}
              size="sm"
              className="h-7 flex-1 gap-1 text-[11px]"
              onClick={() =>
                onSortChange({
                  ...sort,
                  direction: value as CreatorSearchSortDirection,
                })
              }
            >
              <Icon className="size-3" />
              {label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
