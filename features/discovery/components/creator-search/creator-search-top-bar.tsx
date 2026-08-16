"use client";

import { UserPlusIcon, WandSparklesIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { CreatorSearchPopover } from "./creator-search-popover";
import {
  CreatorSearchFiltersPopover,
  CreatorSearchFollowersPopover,
  CreatorSearchSortPopover,
} from "./creator-search-toolbar-popovers";
import {
  DISCOVERY_TOOLBAR_ICON_PROPS,
  discoveryToolbarBtnClass,
} from "./creator-search-toolbar-utils";
import type { CreatorSearchFilters, CreatorSearchSortState } from "./creator-search-types";

export type CreatorSearchToolbarControlsProps = {
  searchQuery: string;
  onDebouncedSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  searchLoading?: boolean;
  sort: CreatorSearchSortState;
  onSortChange: (value: CreatorSearchSortState) => void;
  filters: CreatorSearchFilters;
  onFiltersChange: (filters: CreatorSearchFilters) => void;
  onOpenFilters: () => void;
  showCampaignRelevance?: boolean;
  onAddMissingCreator?: () => void;
  className?: string;
};

/** Icon popovers + AI Search — lives in the results header row. */
export function CreatorSearchToolbarControls({
  searchQuery,
  onDebouncedSearchChange,
  onSearchSubmit,
  searchLoading,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  onOpenFilters,
  showCampaignRelevance = false,
  onAddMissingCreator,
  className,
}: CreatorSearchToolbarControlsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("discovery-search-exact-toolbar", className)}>
        <CreatorSearchPopover
          searchQuery={searchQuery}
          onDebouncedSearchChange={onDebouncedSearchChange}
          onSearchSubmit={onSearchSubmit}
          loading={searchLoading}
        />

        <CreatorSearchFiltersPopover
          filters={filters}
          onChange={onFiltersChange}
          onOpenAllFilters={onOpenFilters}
        />

        <CreatorSearchFollowersPopover
          filters={filters}
          onChange={onFiltersChange}
        />

        <CreatorSearchSortPopover
          sort={sort}
          onSortChange={onSortChange}
          showCampaignRelevance={showCampaignRelevance}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={discoveryToolbarBtnClass()} asChild>
              <Link href="/ai" aria-label="AI Search">
                <WandSparklesIcon {...DISCOVERY_TOOLBAR_ICON_PROPS} />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">AI Search</TooltipContent>
        </Tooltip>

        {onAddMissingCreator ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={discoveryToolbarBtnClass()}
                aria-label="Add missing creator"
                onClick={onAddMissingCreator}
              >
                <UserPlusIcon {...DISCOVERY_TOOLBAR_ICON_PROPS} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Add missing creator</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
