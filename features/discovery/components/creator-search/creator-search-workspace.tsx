"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { glassFlyoutContentClass } from "@/components/shared/navigation/glass-selection-flyout";
import { cn } from "@/lib/utils";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet";
import { browseUnifiedCreatorsAction } from "@/features/campaigns/creator-discovery-actions";
import { refreshCreatorsBatchAction } from "@/features/discovery/enrichment/actions";
import { pollCreatorsAfterBatchRefresh } from "@/features/discovery/enrichment/poll-creator-refresh";
import {
  addUnifiedCreatorsToShortlist,
  describeAddOutcome,
} from "@/features/discovery/shortlists/add-to-shortlist-client";
import type { ShortlistCampaignOption } from "@/features/discovery/queries";
import { createQuotationFromSelection } from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";

import { CreateListDialog, type CreatedShortlist } from "./create-list-dialog";
import { CreatorSearchActiveFilters } from "./creator-search-active-filters";
import { applyCreatorSearchClientFilters } from "./creator-search-client-filters";
import { CreatorSearchBulkBar } from "./creator-search-bulk-bar";
import { CreatorSearchFilterBar } from "./creator-search-filter-bar";
import { CreatorSearchFilterPanel } from "./creator-search-filter-panel";
import { CreatorSearchResultList } from "./creator-search-result-list";
import { CreatorSearchTopBar } from "./creator-search-top-bar";
import {
  DEFAULT_CREATOR_SEARCH_FILTERS,
  DEFAULT_CREATOR_SEARCH_SORT,
  filtersToBrowseParams,
  type CreatorSearchFilters,
  type CreatorSearchSort,
} from "./creator-search-types";
import { exportCreatorsCsv, sortCreators, stashCompareQueue } from "./creator-search-utils";
import { stashDiscoverySelection } from "./discovery-selection-storage";
import {
  filterSelectedCreators,
  useCreatorSelection,
} from "@/features/creators/picker/creator-selection-hooks";

const PAGE_SIZE = 50;
const SAVED_SEARCH_KEY = "thinkway:creator-search-saved:v1";

type Props = {
  shortlists: Array<{ id: string; name: string }>;
  campaigns: ShortlistCampaignOption[];
};

export function CreatorSearchWorkspace({ shortlists: initialShortlists, campaigns }: Props) {
  const router = useRouter();
  const [shortlists, setShortlists] = useState(initialShortlists);
  const [filters, setFilters] = useState<CreatorSearchFilters>(DEFAULT_CREATOR_SEARCH_FILTERS);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CreatorSearchSort>(DEFAULT_CREATOR_SEARCH_SORT);
  const [page, setPage] = useState(1);
  const [creators, setCreators] = useState<UnifiedCreatorResult[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    selectedIds,
    setSelectedIds,
    toggle,
    toggleAllVisible,
  } = useCreatorSelection({ mode: "multi" });
  const [detailCreator, setDetailCreator] = useState<UnifiedCreatorResult | null>(null);
  const [selectedShortlist, setSelectedShortlist] = useState(shortlists[0]?.id ?? "");
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const loadMoreObserver = useRef<IntersectionObserver | null>(null);
  const filtersRef = useRef(filters);
  const searchRef = useRef(search);

  filtersRef.current = filters;
  searchRef.current = search;

  const selectedCreators = useMemo(
    () => filterSelectedCreators(creators, selectedIds),
    [creators, selectedIds]
  );

  useEffect(() => {
    stashDiscoverySelection(selectedCreators);
  }, [selectedCreators]);

  const sortedCreators = useMemo(() => sortCreators(creators, sort), [creators, sort]);
  const visibleCreatorIds = useMemo(
    () => sortedCreators.map((c) => c.unified_id),
    [sortedCreators]
  );

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed";
      if (!append) setError(message);
      toast.error(message);
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

  function handleToggleSelect(creator: UnifiedCreatorResult) {
    toggle(creator.unified_id);
  }

  function handleToggleSelectAll() {
    toggleAllVisible(visibleCreatorIds);
  }

  function addCreatorsToList(targets: UnifiedCreatorResult[], listId?: string) {
    const targetList = listId ?? selectedShortlist;
    if (!targetList) {
      toast.error("Select a target list first.");
      return;
    }
    if (targets.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    startTransition(async () => {
      try {
        const outcome = await addUnifiedCreatorsToShortlist(targetList, targets);
        if (outcome.added > 0) {
          toast.success(describeAddOutcome(outcome));
        } else if (outcome.failed > 0) {
          toast.error(outcome.firstError ?? "Failed to add to list");
        } else if (outcome.ineligible > 0 && outcome.alreadyOnList === 0) {
          toast.error("Selected creators cannot be added to discovery lists.");
        } else {
          toast.info(describeAddOutcome(outcome));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add to list");
      }
    });
  }

  function handleListCreated(created: CreatedShortlist) {
    setShortlists((prev) =>
      prev.some((s) => s.id === created.id) ? prev : [{ id: created.id, name: created.name }, ...prev]
    );
    setSelectedShortlist(created.id);
    if (selectedCreators.length > 0) {
      addCreatorsToList(selectedCreators, created.id);
    }
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
      return `${c.display_name} (${p?.handle ?? "—"}) ${resolveCreatorProfileUrl(p) ?? ""}`.trim();
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Creator summary copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function handleGenerateQuotation() {
    if (selectedCreators.length === 0) {
      toast.error("Select creators to quote");
      return;
    }
    startTransition(async () => {
      const res = await createQuotationFromSelection({
        creators: selectedCreators.map((c) => {
          const p = c.platforms[0];
          return {
            influencer_id: c.influencer_id,
            profile_id: c.discovered_profile_id,
            unified_id: c.unified_id,
            creator_name: c.display_name,
            platform: p?.platform ?? null,
            handle: p?.handle ?? null,
            followers: c.metrics.followers.value ?? p?.follower_count ?? null,
            engagement_rate: c.metrics.engagement_rate.value ?? p?.engagement_rate ?? null,
            country_code: c.country_code ?? c.estimated_country ?? null,
            cost_currency: c.suggested_currency ?? "EGP",
          };
        }),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Quotation created.");
      if (res.data?.id) router.push(quotationDetailPath(res.data.id));
    });
  }

  const selectionStats = useMemo(() => {
    if (selectedCreators.length === 0) {
      return { followers: 0, reach: 0, engagement: 0 };
    }
    const followers = selectedCreators.reduce(
      (sum, c) => sum + (c.metrics.followers.value ?? c.platforms[0]?.follower_count ?? 0),
      0
    );
    const erValues = selectedCreators
      .map((c) => c.metrics.engagement_rate.value)
      .filter((v): v is number => typeof v === "number");
    const engagement =
      erValues.length > 0 ? erValues.reduce((a, b) => a + b, 0) / erValues.length : 0;
    // Estimated reach ≈ followers × average ER (rough planning heuristic).
    const reach = Math.round(followers * (engagement / 100));
    return { followers, reach, engagement };
  }, [selectedCreators]);

  function patchCreatorInList(next: UnifiedCreatorResult) {
    setCreators((prev) =>
      prev.map((creator) => (creator.unified_id === next.unified_id ? next : creator))
    );
    setDetailCreator((current) =>
      current?.unified_id === next.unified_id ? next : current
    );
  }

  function handleBulkRefreshMetrics() {
    if (selectedCreators.length === 0) return;
    const targets = selectedCreators.map((creator) => ({
      unifiedId: creator.unified_id,
      influencerId: creator.influencer_id,
    }));
    startTransition(async () => {
      const result = await refreshCreatorsBatchAction(
        selectedCreators.map((c) => c.unified_id)
      );
      if (result.queued) {
        toast.success(result.message);
        void pollCreatorsAfterBatchRefresh(targets, patchCreatorInList);
      } else {
        toast.error(result.message);
      }
    });
  }

  function clearAllFilters() {
    setFilters(DEFAULT_CREATOR_SEARCH_FILTERS);
    setSearch("");
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
        sort={sort}
        onSortChange={setSort}
        total={total}
        loadedCount={creators.length}
        onSaveSearch={handleSaveSearch}
        onCreateList={() => setCreateListOpen(true)}
        loading={loading || isPending}
      />

      <CreatorSearchFilterBar
        filters={filters}
        onChange={setFilters}
        onOpenAllFilters={() => setFiltersDrawerOpen(true)}
      />

      <CreatorSearchActiveFilters
        filters={filters}
        onChange={setFilters}
        onClearAll={clearAllFilters}
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
        onGenerateQuotation={handleGenerateQuotation}
        onRefreshMetrics={handleBulkRefreshMetrics}
        estFollowers={selectionStats.followers}
        estReach={selectionStats.reach}
        estEngagement={selectionStats.engagement}
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

      <div
        className={cn(
          "flex min-h-0 flex-1 overflow-hidden",
          glassFlyoutContentClass(selectedIds.size > 0)
        )}
      >
        <CreatorSearchResultList
          creators={sortedCreators}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          error={error}
          total={total}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onOpenCreator={setDetailCreator}
          onAddToList={(c) => addCreatorsToList([c])}
          onRetry={runSearch}
          loadMoreRef={loadMoreRef}
        />
      </div>

      <Sheet open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Search filters</SheetTitle>
          <CreatorSearchFilterPanel
            filters={filters}
            onChange={setFilters}
            onClearAll={clearAllFilters}
            onClose={() => setFiltersDrawerOpen(false)}
            total={total}
            loading={loading || isPending}
          />
        </SheetContent>
      </Sheet>

      <CreatorDetailSheet
        creator={detailCreator}
        open={detailCreator != null}
        onOpenChange={(open) => {
          if (!open) setDetailCreator(null);
        }}
        onCreatorUpdated={patchCreatorInList}
      />

      <CreateListDialog
        open={createListOpen}
        onOpenChange={setCreateListOpen}
        campaigns={campaigns}
        onCreated={handleListCreated}
      />
    </div>
  );
}
