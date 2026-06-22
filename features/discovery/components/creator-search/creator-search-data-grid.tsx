"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BadgeCheckIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  UserIcon,
} from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { platformLabel } from "@/features/campaigns/line-assignment";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

import {
  audienceCountryLabel,
  brandSafetyMeta,
  categoriesLabel,
  estimatedPricingLabel,
  formatCreatorCount,
  formatEngagementRate,
  thinkwayAiScore,
} from "./creator-search-utils";

export const CREATOR_SEARCH_ROW_HEIGHT = 60;

/** Wide grid for agency scan speed — horizontal scroll, sticky header. */
export const CREATOR_SEARCH_GRID_TEMPLATE =
  "40px 220px 72px 76px 72px 76px 52px 80px minmax(100px,1fr) 88px 72px 80px 56px";

type Props = {
  creators: UnifiedCreatorResult[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onToggleSelectAll: () => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onAddToList: (creator: UnifiedCreatorResult) => void;
  loadMoreRef: (node: HTMLDivElement | null) => void;
};

const HEADERS = [
  "",
  "Creator",
  "Platform",
  "Followers",
  "Eng. rate",
  "Avg views",
  "Country",
  "Aud. country",
  "Categories",
  "Est. price",
  "TW AI",
  "Safety",
  "",
] as const;

function GridHeader({
  allSelected,
  someSelected,
  onToggleSelectAll,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: () => void;
}) {
  return (
    <div
      className="sticky top-0 z-20 grid border-b border-[#E6EAF2] bg-[#FAFBFD] text-[10px] font-semibold tracking-wide text-[#9099A8] uppercase"
      style={{ gridTemplateColumns: CREATOR_SEARCH_GRID_TEMPLATE }}
    >
      <div className="flex items-center justify-center border-r border-[#E6EAF2]/80 px-2 py-2">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={onToggleSelectAll}
          aria-label="Select all creators on this page"
        />
      </div>
      {HEADERS.slice(1).map((label, i) => (
        <div
          key={label || `h-${i}`}
          className={cn(
            "flex items-center px-2 py-2",
            [3, 4, 5, 9, 10].includes(i + 1) && "justify-end",
            i + 1 === HEADERS.length - 2 && "justify-end"
          )}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function CreatorGridRow({
  creator,
  selected,
  onToggleSelect,
  onOpenCreator,
  onAddToList,
}: {
  creator: UnifiedCreatorResult;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenCreator: () => void;
  onAddToList: () => void;
}) {
  const primary = creator.platforms[0];
  const handle = primary?.handle ? `@${primary.handle.replace(/^@/, "")}` : "—";
  const safety = brandSafetyMeta(creator.authenticity_score);
  const aiScore = thinkwayAiScore(creator);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenCreator}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenCreator();
        }
      }}
      className={cn(
        "grid h-[60px] cursor-pointer items-center border-b border-[#E6EAF2] text-[11px] transition-colors hover:bg-[#F5F8FD]",
        selected && "bg-[#EEF4FF]/70"
      )}
      style={{ gridTemplateColumns: CREATOR_SEARCH_GRID_TEMPLATE }}
    >
      <div
        className="flex h-full items-center justify-center border-r border-[#E6EAF2]/60 px-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={`Select ${creator.display_name}`}
        />
      </div>

      <div className="flex h-full min-w-0 items-center gap-2 px-2 text-left">
        <div className="relative shrink-0">
          {creator.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creator.profile_image_url}
              alt=""
              className="size-9 rounded-full border border-[#E6EAF2] object-cover"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-full border border-[#E6EAF2] bg-[#F5F8FD]">
              <UserIcon className="size-4 text-[#9099A8]" />
            </div>
          )}
          {creator.is_platform_verified ? (
            <BadgeCheckIcon
              className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full bg-white text-[#0057FF]"
              aria-label="Verified"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-[#0B0F1A] hover:text-[#0057FF]">
            {creator.display_name}
          </p>
          <p className="truncate text-[10px] text-[#9099A8]">{handle}</p>
        </div>
      </div>

      <div className="truncate px-2 capitalize text-[#5B6575]">
        {primary ? platformLabel(primary.platform) : "—"}
      </div>
      <div className="px-2 text-right font-medium tabular-nums text-[#0B0F1A]">
        {formatCreatorCount(creator.metrics.followers.value)}
      </div>
      <div className="px-2 text-right tabular-nums text-[#5B6575]">
        {formatEngagementRate(creator.metrics.engagement_rate.value)}
      </div>
      <div className="px-2 text-right tabular-nums text-[#5B6575]">
        {formatCreatorCount(creator.metrics.avg_views.value)}
      </div>
      <div className="px-2 text-[#5B6575]">
        {creator.country_code ?? "—"}
      </div>
      <div className="px-2 text-[#5B6575]">{audienceCountryLabel(creator)}</div>
      <div className="truncate px-2 text-[#5B6575]" title={categoriesLabel(creator)}>
        {categoriesLabel(creator)}
      </div>
      <div className="px-2 text-right tabular-nums text-[#5B6575]">
        {estimatedPricingLabel(creator)}
      </div>
      <div className="px-2 text-right text-[12px] font-semibold tabular-nums text-[#0057FF]">
        {aiScore != null ? Math.round(aiScore) : "—"}
      </div>
      <div className={cn("px-2 font-medium", safety.className)}>{safety.label}</div>

      <div
        className="flex items-center justify-end px-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={onOpenCreator}>View profile</DropdownMenuItem>
            <DropdownMenuItem onClick={onAddToList}>Add to List</DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleSelect}>
              {selected ? "Deselect" : "Select"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function CreatorSearchDataGrid({
  creators,
  loading,
  loadingMore,
  hasMore,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenCreator,
  onAddToList,
  loadMoreRef,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: creators.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CREATOR_SEARCH_ROW_HEIGHT,
    overscan: 20,
  });

  const allSelected = creators.length > 0 && creators.every((c) => selectedIds.has(c.unified_id));
  const someSelected = creators.some((c) => selectedIds.has(c.unified_id));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-y-contain">
        <div className="min-w-[1180px]">
          <GridHeader
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleSelectAll={onToggleSelectAll}
          />

          {loading && creators.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#9099A8]">
              <Loader2Icon className="size-5 animate-spin" />
              Loading creators…
            </div>
          ) : creators.length === 0 ? (
            <div className="py-20 text-center text-sm text-[#9099A8]">
              No verified creators match your filters.
            </div>
          ) : (
            <div
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const creator = creators[virtualRow.index];
                if (!creator) return null;
                return (
                  <div
                    key={creator.unified_id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full"
                    style={{
                      height: CREATOR_SEARCH_ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <CreatorGridRow
                      creator={creator}
                      selected={selectedIds.has(creator.unified_id)}
                      onToggleSelect={() => onToggleSelect(creator)}
                      onOpenCreator={() => onOpenCreator(creator)}
                      onAddToList={() => onAddToList(creator)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div ref={loadMoreRef} className="h-12" aria-hidden />
          {loadingMore ? (
            <div className="flex justify-center py-3">
              <Loader2Icon className="size-4 animate-spin text-[#9099A8]" />
            </div>
          ) : null}
          {!hasMore && creators.length > 0 ? (
            <p className="py-3 text-center text-[10px] text-[#9099A8]">End of results</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
