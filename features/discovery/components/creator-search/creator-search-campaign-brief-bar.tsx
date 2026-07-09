"use client";

import { CheckCircle2Icon, PlusIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CreatorSearchFilterToolbarButton } from "./creator-search-filter-bar";
import { CreatorSearchPopover } from "./creator-search-popover";
import { CreatorSearchSortToolbar } from "./creator-search-sort-toolbar";
import type { CreatorSearchFilters, CreatorSearchSortState } from "./creator-search-types";

function truncateFileName(name: string, max = 32): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  const base = ext ? name.slice(0, dot) : name;
  const keep = Math.max(8, max - ext.length - 1);
  return `${base.slice(0, keep)}…${ext}`;
}

type Props = {
  fileName?: string | null;
  hasBrief: boolean;
  onUploadClick: () => void;
  onUseAiSearch: () => void;
  aiSearchDisabled?: boolean;
  aiExtracting?: boolean;
  searchQuery: string;
  onDebouncedSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  searchLoading?: boolean;
  sort: CreatorSearchSortState;
  onSortChange: (value: CreatorSearchSortState) => void;
  filters: CreatorSearchFilters;
  onOpenFilters: () => void;
  showCampaignRelevance?: boolean;
};

export function CreatorSearchCampaignBriefBar({
  fileName,
  hasBrief,
  onUploadClick,
  onUseAiSearch,
  aiSearchDisabled,
  aiExtracting,
  searchQuery,
  onDebouncedSearchChange,
  onSearchSubmit,
  searchLoading,
  sort,
  onSortChange,
  filters,
  onOpenFilters,
  showCampaignRelevance = false,
}: Props) {
  const showBriefReady = hasBrief && Boolean(fileName);

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background px-3 py-2.5 md:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">Campaign brief</span>
        {showBriefReady ? (
          <>
            <CheckCircle2Icon
              className="size-4 shrink-0 text-[#1D9E75]"
              aria-label="Brief uploaded"
            />
            <span
              className="max-w-[180px] truncate text-xs font-medium text-foreground sm:max-w-[240px]"
              title={fileName ?? undefined}
            >
              {truncateFileName(fileName!)}
            </span>
            <Button
              type="button"
              variant="link"
              className="h-auto gap-1 p-0 text-sm font-medium text-[#1D9E75]"
              onClick={onUploadClick}
            >
              Replace
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="link"
            className="h-auto gap-1 p-0 text-sm font-medium text-[#1D9E75]"
            onClick={onUploadClick}
          >
            <PlusIcon className="size-4" />
            Upload file
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1.5 text-xs", aiExtracting && "pointer-events-none opacity-70")}
          disabled={!hasBrief || aiSearchDisabled || aiExtracting}
          onClick={onUseAiSearch}
        >
          <SparklesIcon className={cn("size-3.5", aiExtracting && "animate-pulse")} />
          <span className="hidden sm:inline">Use AI to find creators</span>
          <span className="sm:hidden">AI search</span>
        </Button>

        <CreatorSearchFilterToolbarButton
          filters={filters}
          search={searchQuery}
          onOpenAllFilters={onOpenFilters}
        />

        <CreatorSearchSortToolbar
          sort={sort}
          onSortChange={onSortChange}
          showCampaignRelevance={showCampaignRelevance}
          className="hidden sm:block"
        />

        <CreatorSearchPopover
          searchQuery={searchQuery}
          onDebouncedSearchChange={onDebouncedSearchChange}
          onSearchSubmit={onSearchSubmit}
          loading={searchLoading}
        />
      </div>
    </div>
  );
}
