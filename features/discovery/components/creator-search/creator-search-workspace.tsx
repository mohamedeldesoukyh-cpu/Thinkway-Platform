"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";

import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet";
import { browseUnifiedCreatorsAction } from "@/features/campaigns/creator-discovery-actions";
import { addToShortlistAction } from "@/features/discovery/actions";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { applyCreatorSearchClientFilters } from "./creator-search-client-filters";
import { CreatorSearchBulkBar } from "./creator-search-bulk-bar";
import { CreatorSearchDataGrid } from "./creator-search-data-grid";
import { CreatorSearchFilterSidebar } from "./creator-search-filter-sidebar";
import { CreatorSearchTopBar } from "./creator-search-top-bar";
import {
  DEFAULT_CREATOR_SEARCH_FILTERS,
  filtersToBrowseParams,
  type CreatorSearchFilters,
} from "./creator-search-types";
import { exportCreatorsCsv, stashCompareQueue } from "./creator-search-utils";

const PAGE_SIZE = 50;
const SAVED_SEARCH_KEY = "thinkway:creator-search-saved:v1";

type Props = {
  shortlists: Array<{ id: string; name: string }>;
};

export function CreatorSearchWorkspace({ shortlists }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<CreatorSearchFilters>(DEFAULT_CREATOR_SEARCH_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creators, setCreators] = useState<UnifiedCreatorResult[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailCreator, setDetailCreator] = useState<UnifiedCreatorResult | null>(null);
  const [selectedShortlist, setSelectedShortlist] = useState(shortlists[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const loadMoreObserver = useRef<IntersectionObserver | null>(null);
  const filtersRef = useRef(filters);
  const searchRef = useRef(search);

  filtersRef.current = filters;
  searchRef.current = search;

  const selectedCreators = useMemo(
    () => creators.filter((c) => selectedIds.has(c.unified_id)),
    [creators, selectedIds]
  );

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const mergedFilters: CreatorSearchFilters = {
        ...filtersRef.current,
        search: searchRef.current,
      };
      const result = await browseUnifiedCreatorsAction(
        filtersToBrowseParams(mergedFilters, pageNum, PAGE_SIZE)
      );
      const filtered = applyCreatorSearchClientFilters(result.creators, mergedFilters);

      setTotal(result.total);
      setCreators((prev) => {
        const next = append ? [...prev, ...filtered] : filtered;
        const unique = new Map(next.map((c) => [c.unified_id, c]));
        return [...unique.values()];
      });
      setHasMore(pageNum * PAGE_SIZE < result.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const runSearch = useCallback(() => {
    setPage(1);
    setCreators([]);
    setHasMore(true);
    setSelectedIds(new Set());
    void fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setCreators([]);
      setHasMore(true);
      void fetchPage(1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, fetchPage]);

  useEffect(() => {
    if (page <= 1) return;
    void fetchPage(page, true);
  }, [page, fetchPage]);

  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loadMoreObserver.current) loadMoreObserver.current.disconnect();
      if (!node) return;
      loadMoreObserver.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore) {
            setPage((p) => p + 1);
          }
        },
        { rootMargin: "240px" }
      );
      loadMoreObserver.current.observe(node);
    },
    [hasMore, loading, loadingMore]
  );

  function toggleSelect(creator: UnifiedCreatorResult) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(creator.unified_id)) next.delete(creator.unified_id);
      else next.add(creator.unified_id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allOnPage = creators.every((c) => selectedIds.has(c.unified_id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPage) {
        for (const c of creators) next.delete(c.unified_id);
      } else {
        for (const c of creators) next.add(c.unified_id);
      }
      return next;
    });
  }

  function addCreatorsToList(targets: UnifiedCreatorResult[]) {
    if (!selectedShortlist) {
      toast.error("Select a target list first.");
      return;
    }
    const eligible = targets.filter((c) => c.discovered_profile_id);
    if (eligible.length === 0) {
      toast.error("Selected creators cannot be added to discovery lists.");
      return;
    }
    startTransition(async () => {
      try {
        await Promise.all(
          eligible.map((c) => addToShortlistAction(selectedShortlist, c.discovered_profile_id!))
        );
        toast.success(`Added ${eligible.length} creator(s) to list`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add to list");
      }
    });
  }

  function handleBulkCompare() {
    if (selectedCreators.length < 2) {
      toast.error("Select at least 2 creators to compare");
      return;
    }
    if (selectedCreators.length > MAX_CREATOR_COMPARE) {
      toast.error(`Compare up to ${MAX_CREATOR_COMPARE} creators at a time`);
      return;
    }
    stashCompareQueue(selectedCreators);
    router.push("/discovery/compare");
  }

  function handleBulkExport() {
    if (selectedCreators.length === 0) return;
    const csv = exportCreatorsCsv(selectedCreators);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thinkway-creator-search-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedCreators.length} creators`);
  }

  async function handleBulkShare() {
    if (selectedCreators.length === 0) return;
    const lines = selectedCreators.map((c) => {
      const p = c.platforms[0];
      return `${c.display_name} (${p?.handle ?? "—"}) ${p?.profile_url ?? ""}`.trim();
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Creator summary copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function handleSaveSearch() {
    try {
      localStorage.setItem(
        SAVED_SEARCH_KEY,
        JSON.stringify({ search, filters, savedAt: new Date().toISOString() })
      );
      toast.success("Search saved on this device");
    } catch {
      toast.error("Could not save search");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <CreatorSearchTopBar
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={runSearch}
        total={total}
        loadedCount={creators.length}
        onSaveSearch={handleSaveSearch}
        onCreateList={() => toast.info("Create lists in Discovery hub")}
        loading={loading || isPending}
      />

      <CreatorSearchBulkBar
        selectedCount={selectedIds.size}
        shortlists={shortlists}
        selectedShortlist={selectedShortlist}
        onShortlistChange={setSelectedShortlist}
        onClearSelection={() => setSelectedIds(new Set())}
        onAddToList={() => addCreatorsToList(selectedCreators)}
        onCompare={handleBulkCompare}
        onExport={handleBulkExport}
        onShare={handleBulkShare}
        onAiMatch={() => {
          if (selectedCreators.length === 0) {
            toast.info("Select creators, then run AI Match from AI Analyst");
            return;
          }
          toast.info(
            <span>
              Open{" "}
              <Link href="/ai" className="font-semibold underline">
                AI Analyst
              </Link>{" "}
              to match {selectedCreators.length} selected creator(s)
            </span>
          );
        }}
        busy={isPending}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CreatorSearchFilterSidebar filters={filters} onChange={setFilters} />

        <CreatorSearchDataGrid
          creators={creators}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onOpenCreator={setDetailCreator}
          onAddToList={(c) => addCreatorsToList([c])}
          loadMoreRef={loadMoreRef}
        />
      </div>

      <CreatorDetailSheet
        creator={detailCreator}
        open={detailCreator != null}
        onOpenChange={(open) => {
          if (!open) setDetailCreator(null);
        }}
      />
    </div>
  );
}
