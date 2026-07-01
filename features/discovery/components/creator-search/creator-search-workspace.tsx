"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";
import { CREATOR_IMPORT_COMPLETED_EVENT } from "@/lib/discovery-import/constants";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { glassFlyoutContentClass } from "@/components/shared/navigation/glass-selection-flyout";
import { cn } from "@/lib/utils";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet";
import { browseUnifiedCreatorsAction } from "@/features/campaigns/creator-discovery-actions";
import {
  refreshCreatorAction,
  refreshCreatorPlatformAction,
  refreshCreatorsBatchAction,
  stopCreatorMetricsRefreshAction,
  stopCreatorsMetricsRefreshBatchAction,
} from "@/features/discovery/enrichment/actions";
import {
  pollCreatorAfterRefresh,
  pollCreatorsAfterBatchRefresh,
} from "@/features/discovery/enrichment/poll-creator-refresh";
import {
  isEnrichmentInProgress,
  syncStatusToEnrichmentStatus,
  resolveCreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import {
  addUnifiedCreatorsToShortlists,
  describeAddOutcome,
  type AddCreatorPlatformSelection,
} from "@/features/discovery/shortlists/add-to-shortlist-client";
import { AddToShortlistDialog } from "@/features/discovery/shortlists/components/add-to-shortlist-dialog";
import {
  needsPlatformAccountSelection,
  SelectPlatformAccountsDialog,
} from "@/features/discovery/shortlists/components/select-platform-accounts-dialog";
import type { ShortlistCampaignOption } from "@/features/discovery/queries";
import { createQuotationFromSelection } from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import {
  CREATOR_SEARCH_QUERY_PARAM,
  applyCategoriesToUrlParams,
  categoriesEqual,
  categoriesFromUrlParams,
} from "@/lib/creators/category-filter";

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
  type CreatorSearchSortState,
} from "./creator-search-types";
import {
  normalizeDiscoverySearchQuery,
  resolveCreatorSearchQueryFromCreator,
  upsertCreatorInResults,
} from "@/lib/discovery/creator-search-query";
import { exportCreatorsCsv, sortCreators, stashCompareQueue } from "./creator-search-utils";
import { stashDiscoverySelection } from "./discovery-selection-storage";
import {
  useCreatorSelection,
} from "@/features/creators/picker/creator-selection-hooks";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 250;
const SAVED_SEARCH_KEY = "thinkway:creator-search-saved:v1";

type Props = {
  shortlists: Array<{ id: string; name: string }>;
  campaigns: ShortlistCampaignOption[];
};

export function CreatorSearchWorkspace({ shortlists: initialShortlists, campaigns }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialCategories = categoriesFromUrlParams(searchParams);
  const initialSearch = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";
  const [shortlists, setShortlists] = useState(initialShortlists);
  const [filters, setFilters] = useState<CreatorSearchFilters>(() => ({
    ...DEFAULT_CREATOR_SEARCH_FILTERS,
    categories: initialCategories,
  }));
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sort, setSort] = useState<CreatorSearchSortState>(DEFAULT_CREATOR_SEARCH_SORT);
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
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [addToShortlistOpen, setAddToShortlistOpen] = useState(false);
  const [pendingAddCreators, setPendingAddCreators] = useState<UnifiedCreatorResult[]>([]);
  const [pendingPlatformSelections, setPendingPlatformSelections] = useState<
    AddCreatorPlatformSelection[]
  >([]);
  const [platformSelectOpen, setPlatformSelectOpen] = useState(false);
  const [pendingShortlistCreator, setPendingShortlistCreator] = useState<UnifiedCreatorResult | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [selectedCreatorMap, setSelectedCreatorMap] = useState<
    Map<string, UnifiedCreatorResult>
  >(() => new Map());
  const loadMoreObserver = useRef<IntersectionObserver | null>(null);
  const filtersRef = useRef(filters);
  const searchRef = useRef(search);
  const reqIdRef = useRef(0);
  const skipCategoryUrlWriteRef = useRef(false);
  const skipSearchUrlWriteRef = useRef(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedCreatorsRef = useRef<Map<string, UnifiedCreatorResult>>(new Map());

  filtersRef.current = filters;
  searchRef.current = debouncedSearch;

  const categoriesFromUrl = useMemo(() => categoriesFromUrlParams(searchParams), [searchParams]);
  const searchFromUrl = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";

  // URL → search (back/forward, refresh)
  useEffect(() => {
    setSearch((prev) => (prev === searchFromUrl ? prev : searchFromUrl));
    setDebouncedSearch((prev) => (prev === searchFromUrl ? prev : searchFromUrl));
    skipSearchUrlWriteRef.current = true;
  }, [searchFromUrl]);

  // URL → filters (chip links, back/forward). Skip the next filters → URL pass when applied.
  useEffect(() => {
    setFilters((prev) => {
      if (categoriesEqual(prev.categories, categoriesFromUrl)) return prev;
      skipCategoryUrlWriteRef.current = true;
      return { ...prev, categories: categoriesFromUrl };
    });
  }, [categoriesFromUrl]);

  // filters → URL (filter bar / clear). Only react to filter changes, not URL updates.
  useEffect(() => {
    if (skipCategoryUrlWriteRef.current) {
      skipCategoryUrlWriteRef.current = false;
      return;
    }

    const filterCategories = filters.categories;
    const urlCategories = categoriesFromUrlParams(searchParams);
    if (categoriesEqual(filterCategories, urlCategories)) return;

    const params = new URLSearchParams(searchParams.toString());
    applyCategoriesToUrlParams(params, filterCategories);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl === currentUrl) return;

    router.replace(nextUrl, { scroll: false });
    // searchParams read for merge/compare only; URL → filters handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid replace loop on navigation
  }, [filters.categories, pathname, router]);

  // search → URL (debounced live sync)
  useEffect(() => {
    if (skipSearchUrlWriteRef.current) {
      skipSearchUrlWriteRef.current = false;
      return;
    }

    const urlSearch = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";
    if (debouncedSearch === urlSearch) return;

    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set(CREATOR_SEARCH_QUERY_PARAM, debouncedSearch);
    } else {
      params.delete(CREATOR_SEARCH_QUERY_PARAM);
    }
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl === currentUrl) return;

    router.replace(nextUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid replace loop on navigation
  }, [debouncedSearch, pathname, router]);

  // Debounce search input (250ms live search)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  const selectedCreators = useMemo(
    () => [...selectedCreatorMap.values()],
    [selectedCreatorMap]
  );

  function clearCreatorSelection() {
    setSelectedIds(new Set());
    setSelectedCreatorMap(new Map());
  }

  function syncPendingCreators(nextCreators: UnifiedCreatorResult[]) {
    setPendingAddCreators(nextCreators);
    setPendingPlatformSelections((prev) =>
      prev.filter((entry) => nextCreators.some((c) => c.unified_id === entry.creator.unified_id))
    );
    const nextIds = new Set(nextCreators.map((creator) => creator.unified_id));
    setSelectedIds(nextIds);
    setSelectedCreatorMap(new Map(nextCreators.map((creator) => [creator.unified_id, creator])));
  }

  useEffect(() => {
    stashDiscoverySelection(selectedCreators);
  }, [selectedCreators]);

  const sortedCreators = useMemo(() => sortCreators(creators, sort), [creators, sort]);
  const visibleCreatorIds = useMemo(
    () => sortedCreators.map((c) => c.unified_id),
    [sortedCreators]
  );
  const inFlightCreators = useMemo(
    () =>
      sortedCreators.filter((creator) =>
        isEnrichmentInProgress(resolveCreatorEnrichmentStatus(creator.enrichment_status))
      ),
    [sortedCreators]
  );
  const selectedInFlightCreators = useMemo(
    () =>
      selectedCreators.filter((creator) =>
        isEnrichmentInProgress(resolveCreatorEnrichmentStatus(creator.enrichment_status))
      ),
    [selectedCreators]
  );

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    const requestId = ++reqIdRef.current;
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
      if (requestId !== reqIdRef.current) return;

      let filtered = applyCreatorSearchClientFilters(result.creators, mergedFilters);
      for (const creator of filtered) {
        pinnedCreatorsRef.current.delete(creator.unified_id);
      }
      for (const pinned of pinnedCreatorsRef.current.values()) {
        filtered = upsertCreatorInResults(filtered, pinned).creators;
      }

      setTotal(Math.max(result.total, filtered.length));
      setCreators((prev) => {
        const next = append ? [...prev, ...filtered] : filtered;
        const unique = new Map(next.map((c) => [c.unified_id, c]));
        return [...unique.values()];
      });
      setHasMore(result.has_more ?? pageNum * PAGE_SIZE < result.total);
    } catch (err) {
      if (requestId !== reqIdRef.current) return;
      const message = err instanceof Error ? err.message : "Search failed";
      if (!append) setError(message);
      toast.error(message);
    } finally {
      if (requestId !== reqIdRef.current) return;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const runSearch = useCallback(
    (immediateQuery?: string) => {
      if (immediateQuery !== undefined) {
        const normalizedQuery = normalizeDiscoverySearchQuery(immediateQuery);
        searchRef.current = normalizedQuery;
        setSearch(normalizedQuery);
        setDebouncedSearch(normalizedQuery);
      }
      setPage(1);
      setCreators([]);
      setHasMore(true);
      clearCreatorSelection();
      void fetchPage(1, false);
    },
    [fetchPage]
  );

  useEffect(() => {
    setPage(1);
    setCreators([]);
    setHasMore(true);
    void fetchPage(1, false);
  }, [filters, debouncedSearch, fetchPage]);

  useEffect(() => {
    if (page <= 1) return;
    void fetchPage(page, true);
  }, [page, fetchPage]);

  // Refetch when an import completes (same tab or another tab via localStorage).
  useEffect(() => {
    function refreshAfterImport() {
      setPage(1);
      void fetchPage(1, false);
    }

    function onStorage(event: StorageEvent) {
      if (event.key === CREATOR_IMPORT_COMPLETED_EVENT) refreshAfterImport();
    }

    window.addEventListener(CREATOR_IMPORT_COMPLETED_EVENT, refreshAfterImport);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CREATOR_IMPORT_COMPLETED_EVENT, refreshAfterImport);
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchPage]);

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
    setSelectedCreatorMap((prev) => {
      const next = new Map(prev);
      if (next.has(creator.unified_id)) next.delete(creator.unified_id);
      else next.set(creator.unified_id, creator);
      return next;
    });
  }

  function handleToggleSelectAll() {
    const allSelected =
      visibleCreatorIds.length > 0 && visibleCreatorIds.every((id) => selectedIds.has(id));
    toggleAllVisible(visibleCreatorIds);
    setSelectedCreatorMap((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        for (const id of visibleCreatorIds) next.delete(id);
      } else {
        for (const creator of sortedCreators) {
          if (visibleCreatorIds.includes(creator.unified_id)) {
            next.set(creator.unified_id, creator);
          }
        }
      }
      return next;
    });
  }

  function openAddToShortlistModal(
    targets: UnifiedCreatorResult[],
    selections: AddCreatorPlatformSelection[] = []
  ) {
    if (targets.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    setPendingAddCreators(targets);
    setPendingPlatformSelections(selections);
    setAddToShortlistOpen(true);
  }

  function addCreatorsToLists(
    shortlistIds: string[],
    targets: UnifiedCreatorResult[],
    selections: AddCreatorPlatformSelection[] = []
  ) {
    if (shortlistIds.length === 0) {
      toast.error("Select at least one shortlist.");
      return;
    }
    if (targets.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    startTransition(async () => {
      try {
        const outcome = await addUnifiedCreatorsToShortlists(shortlistIds, targets, selections);
        if (outcome.added > 0) {
          toast.success(describeAddOutcome(outcome));
        } else if (outcome.failed > 0) {
          toast.error(outcome.firstError ?? "Failed to add to list");
        } else if (outcome.ineligible > 0 && outcome.alreadyOnList === 0) {
          toast.error("Selected creators cannot be added to discovery lists.");
        } else {
          toast.info(describeAddOutcome(outcome));
        }
        setAddToShortlistOpen(false);
        setPendingAddCreators([]);
        setPendingPlatformSelections([]);
        clearCreatorSelection();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add to list");
      }
    });
  }

  function handleAddCreatorToList(creator: UnifiedCreatorResult) {
    if (needsPlatformAccountSelection(creator)) {
      setPendingShortlistCreator(creator);
      setPlatformSelectOpen(true);
      return;
    }
    openAddToShortlistModal([creator]);
  }

  function handleConfirmPlatformAccounts(platformAccountIds: string[]) {
    if (!pendingShortlistCreator) return;
    openAddToShortlistModal(
      [pendingShortlistCreator],
      [{ creator: pendingShortlistCreator, platformAccountIds }]
    );
    setPendingShortlistCreator(null);
  }

  function handleBulkAddToList() {
    if (selectedCreators.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    openAddToShortlistModal(selectedCreators);
  }

  function handleAddToShortlistConfirm({ shortlistIds }: { shortlistIds: string[] }) {
    addCreatorsToLists(shortlistIds, pendingAddCreators, pendingPlatformSelections);
  }

  function handleListCreated(created: CreatedShortlist) {
    setShortlists((prev) =>
      prev.some((s) => s.id === created.id) ? prev : [{ id: created.id, name: created.name }, ...prev]
    );
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

  function syncDiscoverySearchQuery(query: string) {
    const normalized = normalizeDiscoverySearchQuery(query);
    if (!normalized || searchRef.current === normalized) return;
    searchRef.current = normalized;
    setSearch(normalized);
    setDebouncedSearch(normalized);
  }

  function upsertCreatorInList(next: UnifiedCreatorResult) {
    pinnedCreatorsRef.current.set(next.unified_id, next);
    setCreators((prev) => upsertCreatorInResults(prev, next).creators);
    setTotal((prev) => Math.max(prev, 1));
    setDetailCreator((current) =>
      current?.unified_id === next.unified_id ? next : current
    );
  }

  function patchCreatorInList(next: UnifiedCreatorResult) {
    upsertCreatorInList(next);
  }

  function handleMissingCreatorAdded(creator: UnifiedCreatorResult) {
    const query =
      resolveCreatorSearchQueryFromCreator(creator) ||
      normalizeDiscoverySearchQuery(searchRef.current);

    upsertCreatorInList(creator);
    if (query) syncDiscoverySearchQuery(query);

    setSelectedIds((prev) => new Set(prev).add(creator.unified_id));
    setSelectedCreatorMap((prev) => {
      const next = new Map(prev);
      next.set(creator.unified_id, creator);
      return next;
    });
  }

  function handleMissingCreatorUpdated(creator: UnifiedCreatorResult) {
    upsertCreatorInList(creator);

    const query = resolveCreatorSearchQueryFromCreator(creator);
    if (query) syncDiscoverySearchQuery(query);
  }

  function patchCreatorEnrichmentStatus(
    unifiedId: string,
    status: ReturnType<typeof syncStatusToEnrichmentStatus>
  ) {
    setCreators((prev) =>
      prev.map((creator) =>
        creator.unified_id === unifiedId
          ? { ...creator, enrichment_status: status }
          : creator
      )
    );
    setDetailCreator((current) =>
      current?.unified_id === unifiedId ? { ...current, enrichment_status: status } : current
    );
  }

  function applyStopRefreshResult(
    unifiedIds: string[],
    result: { ok: boolean; stopped: boolean; message: string; stoppedCount?: number }
  ) {
    if (result.stopped) {
      toast.success(result.message);
      for (const unifiedId of unifiedIds) {
        const creator = creators.find((c) => c.unified_id === unifiedId);
        if (!creator) continue;
        const nextStatus = creator.last_enriched_at ? "enriched" : "never";
        patchCreatorEnrichmentStatus(unifiedId, nextStatus);
      }
    } else if (result.ok) {
      toast.info(result.message);
    } else {
      toast.error(result.message);
    }
  }

  function handleBulkStopRefresh() {
    if (selectedInFlightCreators.length === 0) return;
    const unifiedIds = selectedInFlightCreators.map((c) => c.unified_id);
    startTransition(async () => {
      const result = await stopCreatorsMetricsRefreshBatchAction(unifiedIds);
      applyStopRefreshResult(unifiedIds, result);
    });
  }

  function handleStopAllRefresh() {
    if (inFlightCreators.length === 0) return;
    const unifiedIds = inFlightCreators.map((c) => c.unified_id);
    startTransition(async () => {
      const result = await stopCreatorsMetricsRefreshBatchAction(unifiedIds);
      applyStopRefreshResult(unifiedIds, result);
    });
  }

  function handleStopRefreshForCreator(creator: UnifiedCreatorResult) {
    startTransition(async () => {
      const result = await stopCreatorMetricsRefreshAction(creator.unified_id);
      applyStopRefreshResult([creator.unified_id], result);
    });
  }

  function handleRefreshMetricsForCreator(
    creator: UnifiedCreatorResult,
    platformAccountId?: string | null
  ) {
    if (!creator.influencer_id) {
      toast.error("Could not refresh", {
        description: "This creator has no linked vendor profile.",
      });
      return;
    }

    const { unified_id: unifiedId, influencer_id: influencerId } = creator;
    const previousStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
    patchCreatorEnrichmentStatus(unifiedId, "queued");

    startTransition(async () => {
      const result = platformAccountId
        ? await refreshCreatorPlatformAction(influencerId, platformAccountId)
        : await refreshCreatorAction(influencerId);
      if (result.queued) {
        void pollCreatorAfterRefresh(
          { unifiedId, influencerId },
          {
            onUpdated: patchCreatorInList,
            onStatusChange: (syncStatus) => {
              patchCreatorEnrichmentStatus(unifiedId, syncStatusToEnrichmentStatus(syncStatus));
            },
            onComplete: (syncStatus) => {
              if (syncStatus === "completed") {
                toast.success(
                  platformAccountId ? "Platform metrics updated" : "Creator metrics updated"
                );
              } else if (syncStatus === "failed") {
                toast.error("Creator refresh failed", {
                  description: "Apify enrichment did not complete successfully.",
                });
              }
            },
          }
        );
        return;
      }

      patchCreatorEnrichmentStatus(unifiedId, previousStatus);
      toast.error("Could not refresh", { description: result.message });
    });
  }

  function handleBulkRefreshMetrics() {
    if (selectedCreators.length === 0) return;
    const targets = selectedCreators.map((creator) => ({
      unifiedId: creator.unified_id,
      influencerId: creator.influencer_id,
    }));
    for (const target of targets) {
      if (target.influencerId) {
        patchCreatorEnrichmentStatus(target.unifiedId, "queued");
      }
    }
    startTransition(async () => {
      const result = await refreshCreatorsBatchAction(
        selectedCreators.map((c) => c.unified_id)
      );
      if (result.queued) {
        toast.success(result.message);
        void pollCreatorsAfterBatchRefresh(targets, {
          onUpdated: patchCreatorInList,
          onStatusChange: ({ unifiedId, status }) => {
            patchCreatorEnrichmentStatus(unifiedId, syncStatusToEnrichmentStatus(status));
          },
          onComplete: ({ status }) => {
            if (status === "completed") {
              toast.success("Creator metrics updated");
            } else if (status === "failed") {
              toast.error("Creator refresh failed");
            }
          },
        });
      } else {
        toast.error(result.message);
      }
    });
  }

  function clearAllFilters() {
    setFilters(DEFAULT_CREATOR_SEARCH_FILTERS);
    setSearch("");
    setDebouncedSearch("");
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
        onSearchSubmit={() => runSearch(search)}
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
        search={search}
        onChange={setFilters}
        onClearAll={clearAllFilters}
        onOpenAllFilters={() => setFiltersDrawerOpen(true)}
      />

      <CreatorSearchActiveFilters
        filters={filters}
        onChange={setFilters}
        onClearAll={clearAllFilters}
      />

      <CreatorSearchBulkBar
        selectedCount={selectedCreators.length}
        onClearSelection={clearCreatorSelection}
        onAddToList={handleBulkAddToList}
        onCompare={handleBulkCompare}
        onExport={handleBulkExport}
        onShare={handleBulkShare}
        onGenerateQuotation={handleGenerateQuotation}
        onRefreshMetrics={handleBulkRefreshMetrics}
        onStopRefresh={handleBulkStopRefresh}
        stopRefreshDisabled={selectedInFlightCreators.length === 0}
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
          glassFlyoutContentClass(selectedCreators.length > 0)
        )}
      >
        <CreatorSearchResultList
          creators={sortedCreators}
          sort={sort}
          onSortChange={setSort}
          platformFilter={filters.platforms}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          error={error}
          total={total}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onOpenCreator={setDetailCreator}
          onAddToList={handleAddCreatorToList}
          onRefreshMetrics={handleRefreshMetricsForCreator}
          onStopRefresh={handleStopRefreshForCreator}
          onStopAllRefresh={handleStopAllRefresh}
          inFlightCount={inFlightCreators.length}
          onRetry={runSearch}
          loadMoreRef={loadMoreRef}
          showAddMissingCreator={debouncedSearch.trim().length > 0}
          onMissingCreatorAdded={handleMissingCreatorAdded}
          onMissingCreatorEnrichmentStatusChange={patchCreatorEnrichmentStatus}
          onMissingCreatorUpdated={handleMissingCreatorUpdated}
        />
      </div>

      <Sheet open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full border-l border-[#e2e8f0] p-0 sm:max-w-[560px]"
        >
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

      <SelectPlatformAccountsDialog
        open={platformSelectOpen}
        onOpenChange={(open) => {
          setPlatformSelectOpen(open);
          if (!open) setPendingShortlistCreator(null);
        }}
        creator={pendingShortlistCreator}
        onConfirm={handleConfirmPlatformAccounts}
      />

      <AddToShortlistDialog
        open={addToShortlistOpen}
        onOpenChange={(open) => {
          setAddToShortlistOpen(open);
          if (!open) {
            setPendingAddCreators([]);
            setPendingPlatformSelections([]);
          }
        }}
        creators={pendingAddCreators}
        onCreatorsChange={syncPendingCreators}
        shortlists={shortlists}
        onShortlistsChange={setShortlists}
        onConfirm={handleAddToShortlistConfirm}
        busy={isPending}
      />
    </div>
  );
}
