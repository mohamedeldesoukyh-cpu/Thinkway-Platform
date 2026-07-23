"use client";

import { SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { buildActiveFilterChips, type CreatorSearchFilters } from "./creator-search-types";

type SharedProps = {
  filters: CreatorSearchFilters;
  search: string;
  onOpenAllFilters: () => void;
  total: number;
  loading?: boolean;
};

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex size-4 items-center justify-center rounded-full bg-[#2563eb] text-[9px] font-bold text-white">
      {count}
    </span>
  );
}

/** Desktop filter trigger — opens the right-side filter drawer. */
export function CreatorSearchFilterToolbarButton({
  filters,
  search,
  onOpenAllFilters,
}: Omit<SharedProps, "total" | "loading">) {
  const totalActive = buildActiveFilterChips(filters, search).length;

  return (
    <div className="hidden shrink-0 items-center gap-2 lg:flex">
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5 text-xs"
        onClick={onOpenAllFilters}
      >
        <SlidersHorizontalIcon className="size-3.5" />
        Filters
        <CountBadge count={totalActive} />
      </Button>
    </div>
  );
}

/** Mobile sticky bottom bar — Filters opens drawer; Show results closes it. */
export function CreatorSearchFilterBottomBar({
  filters,
  search = "",
  onOpenAllFilters,
  onShowResults,
  total,
  loading,
}: Pick<
  SharedProps,
  "filters" | "search" | "onOpenAllFilters" | "total" | "loading"
> & {
  onShowResults: () => void;
}) {
  const totalActive = buildActiveFilterChips(filters, search).length;

  return (
    <div className="sticky bottom-0 z-20 flex shrink-0 items-center gap-2 border-t border-[#e2e8f0] dark:border-border bg-white/95 dark:bg-background/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
      <Button
        variant="outline"
        size="sm"
        className="h-9 shrink-0 gap-1.5 text-xs"
        onClick={onOpenAllFilters}
      >
        <SlidersHorizontalIcon className="size-3.5" />
        Filters
        <CountBadge count={totalActive} />
      </Button>
      <Button
        size="sm"
        className="h-9 min-w-0 flex-1 gap-1.5 text-xs"
        onClick={onShowResults}
        disabled={loading}
      >
        {loading ? "Searching…" : `Show ${total.toLocaleString()} results`}
      </Button>
    </div>
  );
}
