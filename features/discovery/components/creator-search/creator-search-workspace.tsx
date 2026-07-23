"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";
import { CREATOR_IMPORT_COMPLETED_EVENT } from "@/lib/discovery-import/constants";

import { DiscoveryFilterSheet } from "@/features/discovery/components/design-system";
import { discoverySelectionFlyoutContentClass } from "@/features/discovery/components/design-system/discovery-selection-flyout";
import { cn } from "@/lib/utils";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import { useCreatorDetailSheetState } from "@/features/discovery/hooks/use-creator-detail-sheet-state";
import { browseUnifiedCreatorsAction, browseCreatorsByInfluencerIdsAction, getAcquisitionJobsStatusAction } from "@/features/campaigns/creator-discovery-actions";
import { createAcquisitionSessionController } from "./creator-search-acquisition-session";
import type { BrowseInvocationCaller } from "@/lib/discovery/browse-invocation-trace";
import {
  traceAcquisitionPollClient,
  traceBrowseInvocationClient,
} from "@/lib/discovery/browse-invocation-trace";
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
import { useManualRefreshFlow } from "@/features/discovery/enrichment/use-manual-refresh-flow";
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
import { removeUnifiedCreatorFromShortlists } from "@/features/discovery/shortlists/remove-from-shortlist-client";
import { needsPlatformAccountSelection } from "@/features/discovery/shortlists/platform-account-selection";
import type { ShortlistCampaignOption } from "@/features/discovery/queries";
import { createQuotationFromSelection } from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { CREATOR_SEARCH_QUERY_PARAM } from "@/lib/creators/category-filter";
import {
  applyCreatorSearchFiltersToUrlParams,
  creatorSearchFiltersFromUrlParams,
  creatorSearchFiltersUrlEqual,
} from "@/lib/creators/creator-search-url-params";

import type { CreatedShortlist } from "./create-list-dialog";
import { CreatorSearchActiveFilters } from "./creator-search-active-filters";
import { clearDiscoverySearchDraft } from "./creator-search-draft-storage";
import { applyCreatorSearchClientFilters, hasClientOnlyCreatorSearchFilters } from "./creator-search-client-filters";
import { CreatorSearchBulkBar } from "./creator-search-bulk-bar";
import { CreatorSearchFilterPanel } from "./creator-search-filter-panel";
import { CreatorSearchResultList } from "./creator-search-result-list";
import {
  CampaignBriefSidebar,
  AiSearchStrategySheet,
  CreatorSearchCampaignRequirementsPanel,
  CreateListDialog,
  AddToShortlistDialog,
  SelectPlatformAccountsDialog,
  ManualRefreshConfirmDialog,
  DeleteDiscoveryCreatorDialog,
} from "./creator-search-lazy-panels";
import {
  DEFAULT_CREATOR_SEARCH_FILTERS,
  DEFAULT_CREATOR_SEARCH_SORT,
  cloneCreatorSearchFilters,
  filtersToBrowseParams,
  filtersToRelaxedBrowseParams,
  hasActiveCreatorSearchFilters,
  type CreatorSearchFilters,
  type CreatorSearchSortState,
} from "./creator-search-types";
import {
  normalizeDiscoverySearchQuery,
  resolveCreatorSearchQueryFromCreator,
  upsertCreatorInResults,
} from "@/lib/discovery/creator-search-query";
import { filterExactCreatorMatches } from "./creator-search-exact-match";
import {
  buildCreatorSearchHybridListItems,
  countCreatorSearchHybridResults,
} from "./creator-search-hybrid-sections";
import {
  scoreCreatorSearchIntent,
  simplifyCreatorSearchQuery,
} from "./creator-search-intent-engine";
import type { DiscoverySearchTaxonomy } from "./creator-search-taxonomy";
import {
  createDiscoverySearchAnalyticsTracker,
  type DiscoverySearchAnalyticsTracker,
} from "@/features/discovery/search-analytics";
import { exportCreatorsCsv, sortCreators, stashCompareQueue } from "./creator-search-utils";
import {
  isCampaignRelevanceSearchActive,
  rankCreatorsByCampaignRelevance,
} from "@/lib/discovery/campaign-relevance-scoring";
import { dedupeCreatorsByPlatformHandle } from "@/lib/discovery/creator-result-dedupe";
import { mergeAiCandidatePools } from "@/lib/discovery/ai-candidate-pool";
import { stashDiscoverySelection } from "./discovery-selection-storage";
import {
  useCreatorSelection,
} from "@/features/creators/picker/creator-selection-hooks";
import { CreatorSearchAiCriteriaChips } from "./creator-search-ai-criteria-chips";
import { CreatorSearchAiExtractingState } from "./creator-search-ai-extracting-state";
import { type CreatorSearchRecommendation } from "./creator-search-recommended-section";
import { buildCreatorSearchRecommendations } from "./creator-search-zero-results-recommendations";
import type { CampaignIntelligenceWorkspaceState } from "@/features/campaign-intelligence-profile/actions/profile-actions";
import {
  buildCreatorFiltersFromProfile,
  buildSearchStrategyFromProfile,
} from "@/features/campaign-intelligence-profile/services/search-strategy";
import type { CampaignIntelligenceProfile, CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";

const PAGE_SIZE = 50;
/** Max creators loaded for AI campaign scoring before Apify acquisition completes. */
const AI_CAMPAIGN_PAGE_SIZE = 200;
/** Relaxed pool size for zero-results recommendations (manual filter mode). */
const ZERO_RESULTS_RECOMMENDATION_PAGE_SIZE = 200;
const SAVED_SEARCH_KEY = "thinkway:creator-search-saved:v1";

type Props = {
  shortlists: Array<{ id: string; name: string }>;
  campaigns: ShortlistCampaignOption[];
  searchTaxonomy: DiscoverySearchTaxonomy;
  initialBriefState?: CampaignIntelligenceWorkspaceState | null;
};

export function CreatorSearchWorkspace({
  shortlists: initialShortlists,
  campaigns,
  searchTaxonomy,
  initialBriefState = null,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialFiltersFromUrl = creatorSearchFiltersFromUrlParams(searchParams);
  const initialSearch = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";
  const profileIdFromUrl = searchParams.get("profileId");
  const aiModeFromUrl = searchParams.get("mode") === "ai";
  const [shortlists, setShortlists] = useState(initialShortlists);
  const [filters, setFilters] = useState<CreatorSearchFilters>(() => initialFiltersFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sort, setSort] = useState<CreatorSearchSortState>(DEFAULT_CREATOR_SEARCH_SORT);
  const [page, setPage] = useState(1);
  const [creators, setCreators] = useState<UnifiedCreatorResult[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [acquisitionPolling, setAcquisitionPolling] = useState(false);
  const acquisitionPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acquisitionPollJobRef = useRef<string[]>([]);
  const acquisitionPollRequestRef = useRef(0);
  const acquisitionLastStatusRef = useRef<string | null>(null);
  const acquisitionRefreshedForJobRef = useRef<string | null>(null);
  const acquisitionPollSeqRef = useRef(0);
  const acquisitionSessionRef = useRef(createAcquisitionSessionController());
  const startAcquisitionPollingRef = useRef<
    (jobIds: string[], requestId: number, filtersSnapshot: CreatorSearchFilters) => void
  >(() => {});
  const fetchPageRef = useRef<
    (
      pageNum: number,
      append: boolean,
      filterOverride?: CreatorSearchFilters,
      options?: {
        skipCoverageBackfill?: boolean;
        caller?: BrowseInvocationCaller;
        acquiredOnly?: boolean;
      }
    ) => Promise<void>
  >(async () => {});
  const {
    selectedIds,
    setSelectedIds,
    toggle,
    toggleAllVisible,
  } = useCreatorSelection({ mode: "multi" });
  const {
    open: detailOpen,
    creator: detailCreator,
    openCreator,
    onOpenChange: onDetailOpenChange,
    closeIfShowing,
    setCreator: setDetailCreator,
  } = useCreatorDetailSheetState();
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
  const [deleteCreatorTarget, setDeleteCreatorTarget] = useState<UnifiedCreatorResult | null>(
    null
  );
  /** Session “Added” state: unified_id → shortlist ids they were added to. */
  const [shortlistMembership, setShortlistMembership] = useState<Map<string, string[]>>(
    () => new Map()
  );
  /** Hidden via row X when the creator cannot be permanently deleted. */
  const [hiddenUnifiedIds, setHiddenUnifiedIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const {
    isPending: manualRefreshPending,
    dialogOpen: manualRefreshDialogOpen,
    setDialogOpen: setManualRefreshDialogOpen,
    assessment: manualRefreshAssessment,
    scopeLabel: manualRefreshScopeLabel,
    requestRefresh: requestManualRefresh,
    chooseRefreshSource: chooseManualRefreshSource,
  } = useManualRefreshFlow();
  const [selectedCreatorMap, setSelectedCreatorMap] = useState<
    Map<string, UnifiedCreatorResult>
  >(() => new Map());
  const loadMoreObserver = useRef<IntersectionObserver | null>(null);
  const filtersRef = useRef(filters);
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const skipFilterUrlWriteRef = useRef(false);
  const skipSearchUrlWriteRef = useRef(false);
  const pinnedCreatorsRef = useRef<Map<string, UnifiedCreatorResult>>(new Map());
  /** Blocks URL → state sync while a full clear is flushing stale query params. */
  const pendingUrlClearRef = useRef<"search" | "all" | false>(false);
  /** Prevents server-provided brief from re-applying after the user clears everything. */
  const suppressBriefHydrationRef = useRef(false);
  /** Runs AI campaign search once when opening /discovery/search?profileId=… */
  const initialBriefSearchDoneRef = useRef(false);
  const searchRef = useRef(initialSearch);
  const searchStartedAtRef = useRef<number | null>(null);
  const analyticsRef = useRef<DiscoverySearchAnalyticsTracker | null>(null);
  const [activeProfile, setActiveProfile] = useState<CampaignIntelligenceProfile | null>(
    initialBriefState?.profile ?? null
  );
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    profileIdFromUrl ?? initialBriefState?.profileId ?? null
  );
  const [aiCriteria, setAiCriteria] = useState<CampaignSearchCriterion[]>([]);
  const [aiModeActive, setAiModeActive] = useState(aiModeFromUrl);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [strategySheetOpen, setStrategySheetOpen] = useState(false);
  const [briefSidebarOpen, setBriefSidebarOpen] = useState(false);
  const [briefWorkspaceState, setBriefWorkspaceState] = useState(initialBriefState);
  const [briefFileName, setBriefFileName] = useState<string | null>(
    initialBriefState?.fileName ?? null
  );
  const [filterResetKey, setFilterResetKey] = useState(0);
  const aiModeRef = useRef(aiModeActive);
  const aiCriteriaRef = useRef(aiCriteria);
  const skipNextFilterFetchRef = useRef(false);
  /** Influencer IDs imported in the current AI acquisition session (Apify-only result set). */
  const sessionAcquiredInfluencerIdsRef = useRef<string[]>([]);
  aiModeRef.current = aiModeActive;
  aiCriteriaRef.current = aiCriteria;
  const [apifySourceUnifiedIds, setApifySourceUnifiedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [recommendedCreators, setRecommendedCreators] = useState<CreatorSearchRecommendation[]>(
    []
  );
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const recommendationReqRef = useRef(0);

  useEffect(() => {
    const pending = pendingUrlClearRef.current;
    if (!pending) return;

    if (pending === "all") {
      if (searchParams.toString() === "") {
        pendingUrlClearRef.current = false;
      }
      return;
    }

    const queryParam = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";
    if (!searchParams.has(CREATOR_SEARCH_QUERY_PARAM) || !queryParam) {
      pendingUrlClearRef.current = false;
    }
  }, [searchParams]);

  filtersRef.current = filters;
  searchRef.current = debouncedSearch;

  const filtersFromUrl = useMemo(
    () => creatorSearchFiltersFromUrlParams(searchParams),
    [searchParams]
  );
  const searchFromUrl = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";

  // URL → search (back/forward, refresh)
  useEffect(() => {
    if (pendingUrlClearRef.current) return;
    setDebouncedSearch((prev) => (prev === searchFromUrl ? prev : searchFromUrl));
    skipSearchUrlWriteRef.current = true;
  }, [searchFromUrl]);

  // URL → filters (chip links, back/forward). Skip the next filters → URL pass when applied.
  useEffect(() => {
    if (pendingUrlClearRef.current) return;
    setFilters((prev) => {
      if (creatorSearchFiltersUrlEqual(prev, filtersFromUrl)) return prev;
      skipFilterUrlWriteRef.current = true;
      return cloneCreatorSearchFilters(filtersFromUrl);
    });
  }, [filtersFromUrl]);

  // filters → URL (filter bar / clear). Only react to filter changes, not URL updates.
  useEffect(() => {
    if (pendingUrlClearRef.current === "all") return;
    if (skipFilterUrlWriteRef.current) {
      skipFilterUrlWriteRef.current = false;
      return;
    }

    const urlFilters = creatorSearchFiltersFromUrlParams(searchParams);
    if (creatorSearchFiltersUrlEqual(filters, urlFilters)) return;

    const params = new URLSearchParams(searchParams.toString());
    applyCreatorSearchFiltersToUrlParams(params, filters);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl === currentUrl) return;

    router.replace(nextUrl, { scroll: false });
    // searchParams read for merge/compare only; URL → filters handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid replace loop on navigation
  }, [filters, pathname, router]);

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

  const handleDebouncedSearchChange = useCallback((value: string) => {
    setDebouncedSearch((prev) => (prev === value ? prev : value));
  }, []);

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

  const searchIntent = useMemo(
    () => scoreCreatorSearchIntent(debouncedSearch, searchTaxonomy),
    [debouncedSearch, searchTaxonomy]
  );
  const isExactCreatorSearch = searchIntent.mode === "exact";
  const isHybridCreatorSearch = searchIntent.mode === "hybrid";

  const showCampaignRelevance = useMemo(
    () => isCampaignRelevanceSearchActive(aiModeActive, aiCriteria),
    [aiModeActive, aiCriteria]
  );

  useEffect(() => {
    if (!showCampaignRelevance && sort.field === "relevance") {
      setSort({ field: "followers", direction: "desc" });
    }
  }, [showCampaignRelevance, sort.field]);

  const sortedCreators = useMemo(() => sortCreators(creators, sort), [creators, sort]);
  const exactMatches = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    if (searchIntent.mode === "discovery") return [];
    return filterExactCreatorMatches(sortedCreators, debouncedSearch);
  }, [debouncedSearch, searchIntent.mode, sortedCreators]);

  const displayCreators = useMemo(() => {
    const base =
      !debouncedSearch.trim() || searchIntent.mode === "discovery"
        ? sortedCreators
        : isExactCreatorSearch
          ? exactMatches
          : sortedCreators;
    if (hiddenUnifiedIds.size === 0) return base;
    return base.filter((creator) => !hiddenUnifiedIds.has(creator.unified_id));
  }, [
    debouncedSearch,
    exactMatches,
    hiddenUnifiedIds,
    isExactCreatorSearch,
    searchIntent.mode,
    sortedCreators,
  ]);

  const shortlistedIds = useMemo(
    () => new Set(shortlistMembership.keys()),
    [shortlistMembership]
  );

  const hybridListItems = useMemo(() => {
    if (!isHybridCreatorSearch || !debouncedSearch.trim()) return undefined;
    const visibleExact =
      hiddenUnifiedIds.size === 0
        ? exactMatches
        : exactMatches.filter((c) => !hiddenUnifiedIds.has(c.unified_id));
    const visibleAll =
      hiddenUnifiedIds.size === 0
        ? sortedCreators
        : sortedCreators.filter((c) => !hiddenUnifiedIds.has(c.unified_id));
    return buildCreatorSearchHybridListItems({
      exactMatches: visibleExact,
      allCreators: visibleAll,
    });
  }, [
    debouncedSearch,
    exactMatches,
    hiddenUnifiedIds,
    isHybridCreatorSearch,
    sortedCreators,
  ]);

  const resultCount = useMemo(() => {
    if (hybridListItems) return countCreatorSearchHybridResults(hybridListItems);
    return displayCreators.length;
  }, [displayCreators.length, hybridListItems]);

  const exactCreatorZeroMatch =
    isExactCreatorSearch &&
    !loading &&
    debouncedSearch.trim().length > 0 &&
    exactMatches.length === 0;

  const showZeroResultsRecommendations =
    !aiModeActive &&
    !loading &&
    !acquisitionPolling &&
    displayCreators.length === 0 &&
    hasActiveCreatorSearchFilters(filters, debouncedSearch);

  const visibleRecommendations = useMemo(() => {
    if (!showZeroResultsRecommendations) return [];
    if (hiddenUnifiedIds.size === 0) return recommendedCreators;
    return recommendedCreators.filter(
      (entry) => !hiddenUnifiedIds.has(entry.creator.unified_id)
    );
  }, [hiddenUnifiedIds, recommendedCreators, showZeroResultsRecommendations]);
  const canSimplifyExactQuery = useMemo(() => {
    const simplified = simplifyCreatorSearchQuery(debouncedSearch);
    return simplified.length > 0 && simplified !== debouncedSearch.trim();
  }, [debouncedSearch]);

  const visibleCreatorIds = useMemo(
    () => displayCreators.map((c) => c.unified_id),
    [displayCreators]
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

  const stopAcquisitionPolling = useCallback(() => {
    if (acquisitionPollRef.current) {
      clearTimeout(acquisitionPollRef.current);
      acquisitionPollRef.current = null;
    }
    acquisitionPollJobRef.current = [];
    acquisitionPollRequestRef.current = 0;
    acquisitionLastStatusRef.current = null;
    setAcquisitionPolling(false);
  }, []);

  const cancelActiveAcquisitionSession = useCallback(async () => {
    stopAcquisitionPolling();
    acquisitionSessionRef.current.stopHeartbeat();
    await acquisitionSessionRef.current.cancelSession();
  }, [stopAcquisitionPolling]);

  const handleClearSearch = useCallback(() => {
    pendingUrlClearRef.current = "search";
    searchRef.current = "";
    skipSearchUrlWriteRef.current = true;
    setDebouncedSearch("");
    clearDiscoverySearchDraft();

    abortRef.current?.abort();
    reqIdRef.current += 1;
    void cancelActiveAcquisitionSession();
    acquisitionRefreshedForJobRef.current = null;
    pinnedCreatorsRef.current.clear();
    setBackfillStatus(null);

    const params = new URLSearchParams(searchParams.toString());
    if (!params.has(CREATOR_SEARCH_QUERY_PARAM)) return;
    params.delete(CREATOR_SEARCH_QUERY_PARAM);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [cancelActiveAcquisitionSession, pathname, router, searchParams]);

  const startAcquisitionPolling = useCallback(
    (jobIds: string[], requestId: number, filtersSnapshot: CreatorSearchFilters) => {
      const uniqueJobIds = [...new Set(jobIds.map((id) => id.trim()).filter(Boolean))];
      if (uniqueJobIds.length === 0) return;

      stopAcquisitionPolling();
      acquisitionPollJobRef.current = uniqueJobIds;
      acquisitionPollRequestRef.current = requestId;
      acquisitionLastStatusRef.current = null;
      acquisitionRefreshedForJobRef.current = null;
      acquisitionPollSeqRef.current = 0;
      const pollStartedAt = Date.now();
      const maxPollMs = 3 * 60_000;
      setAcquisitionPolling(true);
      setBackfillStatus(
        uniqueJobIds.length > 1
          ? "Acquiring creators (Instagram, TikTok)..."
          : "Acquiring creators..."
      );

      const pollKey = uniqueJobIds.join(",");

      const tick = async () => {
        if (
          acquisitionPollJobRef.current.join(",") !== pollKey ||
          acquisitionPollRequestRef.current !== requestId ||
          reqIdRef.current !== requestId
        ) {
          return;
        }

        if (Date.now() - pollStartedAt > maxPollMs) {
          stopAcquisitionPolling();
          setBackfillStatus(
            "Acquisition is taking too long. Stopped waiting — try again or add the creator by URL."
          );
          void cancelActiveAcquisitionSession();
          return;
        }

        const pollSeq = ++acquisitionPollSeqRef.current;

        try {
          const jobStatus = await getAcquisitionJobsStatusAction(uniqueJobIds);
          if (
            acquisitionPollJobRef.current.join(",") !== pollKey ||
            acquisitionPollRequestRef.current !== requestId ||
            reqIdRef.current !== requestId
          ) {
            return;
          }

          traceAcquisitionPollClient({
            jobId: pollKey,
            pollSeq,
            status: jobStatus?.status ?? null,
            completed: jobStatus?.completed ?? false,
            failed: jobStatus?.failed ?? false,
          });

          if (!jobStatus) {
            acquisitionPollRef.current = setTimeout(tick, 2_500);
            return;
          }

          const previousStatus = acquisitionLastStatusRef.current;
          acquisitionLastStatusRef.current = jobStatus.status;

          if (jobStatus.failed) {
            stopAcquisitionPolling();
            setBackfillStatus(
              jobStatus.cancelled
                ? "Search cancelled."
                : jobStatus.errorMessage ?? "Creator acquisition failed. Try broadening your filters."
            );
            return;
          }

          if (jobStatus.cancelled) {
            stopAcquisitionPolling();
            setBackfillStatus("Search cancelled.");
            return;
          }

          if (jobStatus.completed) {
            if (acquisitionPollRef.current) {
              clearTimeout(acquisitionPollRef.current);
              acquisitionPollRef.current = null;
            }
            acquisitionPollJobRef.current = [];
            setAcquisitionPolling(false);

            const transitionedToCompleted = previousStatus !== "completed";
            const alreadyRefreshed = acquisitionRefreshedForJobRef.current === pollKey;

            if (transitionedToCompleted && !alreadyRefreshed) {
              acquisitionRefreshedForJobRef.current = pollKey;
              sessionAcquiredInfluencerIdsRef.current = jobStatus.importedInfluencerIds;
              setBackfillStatus(
                jobStatus.profilesAdded > 0
                  ? `Added ${jobStatus.profilesAdded} Apify creator${jobStatus.profilesAdded === 1 ? "" : "s"}. Refreshing results…`
                  : "Acquisition complete. Refreshing results…"
              );
              void fetchPageRef.current(1, false, filtersSnapshot, {
                skipCoverageBackfill: true,
                caller: "poll_completion_refresh",
                acquiredOnly: true,
              });
            }
            return;
          }

          const nextStatusMessage =
            jobStatus.status === "running"
              ? uniqueJobIds.length > 1
                ? "Acquiring creators (Instagram, TikTok)..."
                : "Acquiring creators..."
              : "Queued for acquisition...";
          setBackfillStatus((current) =>
            current === nextStatusMessage ? current : nextStatusMessage
          );
          acquisitionPollRef.current = setTimeout(tick, 2_500);
        } catch {
          if (
            acquisitionPollJobRef.current.join(",") === pollKey &&
            acquisitionPollRequestRef.current === requestId
          ) {
            acquisitionPollRef.current = setTimeout(tick, 4_000);
          }
        }
      };

      void tick();
    },
    [cancelActiveAcquisitionSession, stopAcquisitionPolling]
  );

  startAcquisitionPollingRef.current = startAcquisitionPolling;

  const fetchZeroResultRecommendations = useCallback(
    async (filtersSnapshot: CreatorSearchFilters, requestId: number) => {
      const recRequestId = ++recommendationReqRef.current;
      setLoadingRecommendations(true);
      setRecommendedCreators([]);

      try {
        const relaxed = await browseUnifiedCreatorsAction(
          {
            ...filtersToRelaxedBrowseParams(
              filtersSnapshot,
              1,
              ZERO_RESULTS_RECOMMENDATION_PAGE_SIZE
            ),
            searchSessionId: acquisitionSessionRef.current.getSessionId(),
            skipCoverageBackfill: true,
          },
          {
            caller: "zero_results_recommendations",
            requestId,
            acquisitionJobId: acquisitionPollJobRef.current[0] ?? null,
          }
        );

        if (
          recRequestId !== recommendationReqRef.current ||
          requestId !== reqIdRef.current
        ) {
          return;
        }

        const recommendations = buildCreatorSearchRecommendations(
          relaxed.creators,
          filtersSnapshot
        );
        setRecommendedCreators(recommendations);
      } catch {
        if (recRequestId !== recommendationReqRef.current) return;
        setRecommendedCreators([]);
      } finally {
        if (recRequestId === recommendationReqRef.current) {
          setLoadingRecommendations(false);
        }
      }
    },
    []
  );

  const fetchPage = useCallback(async (
    pageNum: number,
    append: boolean,
    filterOverride?: CreatorSearchFilters,
    options?: {
      skipCoverageBackfill?: boolean;
      caller?: BrowseInvocationCaller;
      acquiredOnly?: boolean;
    }
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = ++reqIdRef.current;
    if (!append && !options?.skipCoverageBackfill) {
      const hadActiveAcquisition = acquisitionPollJobRef.current.length > 0;
      stopAcquisitionPolling();
      acquisitionSessionRef.current.stopHeartbeat();
      if (hadActiveAcquisition) {
        await acquisitionSessionRef.current.cancelSession();
      }
      await acquisitionSessionRef.current.rotateSession();
    }
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      searchStartedAtRef.current = performance.now();
    }
    setError(null);
    if (!append && !options?.skipCoverageBackfill) {
      setBackfillStatus(null);
    }

    const queryAtFetch = filterOverride ? "" : searchRef.current;
    const intentAtFetch = scoreCreatorSearchIntent(queryAtFetch, searchTaxonomy);

    const caller = options?.caller ?? "unknown";
    traceBrowseInvocationClient(
      {
        caller,
        requestId,
        acquisitionJobId: acquisitionPollJobRef.current[0] ?? null,
      },
      { pageNum, append, skipCoverageBackfill: options?.skipCoverageBackfill ?? false }
    );

    try {
      if (controller.signal.aborted) return;

      const mergedFilters: CreatorSearchFilters = filterOverride ?? {
        ...filtersRef.current,
        search: queryAtFetch,
      };
      const useAiRelevance = isCampaignRelevanceSearchActive(
        aiModeRef.current,
        aiCriteriaRef.current
      );
      const acquiredSession = sessionAcquiredInfluencerIdsRef.current;
      const showAcquiredOnly =
        Boolean(options?.acquiredOnly) || (useAiRelevance && acquiredSession.length > 0);

      if (useAiRelevance && append) {
        return;
      }

      let result: Awaited<ReturnType<typeof browseUnifiedCreatorsAction>>;
      let pool: UnifiedCreatorResult[] = [];

      if (showAcquiredOnly && acquiredSession.length > 0) {
        pool = await browseCreatorsByInfluencerIdsAction(acquiredSession);
        if (controller.signal.aborted || requestId !== reqIdRef.current) return;
        setApifySourceUnifiedIds(new Set(pool.map((creator) => creator.unified_id)));
        result = {
          creators: pool,
          total: pool.length,
          has_more: false,
          page: 1,
          pageSize: pool.length,
          internal_count: pool.length,
          discovery_count: 0,
        };
      } else if (useAiRelevance) {
        setApifySourceUnifiedIds(new Set());
        // Dual-pool fetch: the relaxed pool (platform-only SQL filter) is ordered by
        // thinkway_score, so on-brief creators outside its single page never reach the
        // ranker. The strict pool applies the brief's real filters in SQL, guaranteeing
        // on-brief creators enter the candidate pool regardless of enrichment rank.
        const sessionId = acquisitionSessionRef.current.getSessionId();
        const invocation = {
          caller,
          requestId,
          acquisitionJobId: acquisitionPollJobRef.current[0] ?? null,
        };
        const [strictSettled, relaxedSettled] = await Promise.allSettled([
          browseUnifiedCreatorsAction(
            {
              ...filtersToBrowseParams(mergedFilters, pageNum, AI_CAMPAIGN_PAGE_SIZE),
              searchSessionId: sessionId,
              skipCoverageBackfill: true,
            },
            invocation
          ),
          browseUnifiedCreatorsAction(
            {
              ...filtersToRelaxedBrowseParams(mergedFilters, pageNum, AI_CAMPAIGN_PAGE_SIZE),
              searchSessionId: sessionId,
              skipCoverageBackfill: true,
            },
            invocation
          ),
        ]);
        if (controller.signal.aborted || requestId !== reqIdRef.current) return;
        if (strictSettled.status === "rejected" && relaxedSettled.status === "rejected") {
          throw relaxedSettled.reason;
        }
        const strictCreators =
          strictSettled.status === "fulfilled" ? strictSettled.value.creators : [];
        const baseResult =
          relaxedSettled.status === "fulfilled"
            ? relaxedSettled.value
            : (strictSettled as PromiseFulfilledResult<
                Awaited<ReturnType<typeof browseUnifiedCreatorsAction>>
              >).value;
        pool = mergeAiCandidatePools(strictCreators, baseResult.creators);
        result = {
          ...baseResult,
          creators: pool,
          total: pool.length,
          has_more: false,
        };
      } else {
        setApifySourceUnifiedIds(new Set());
        result = await browseUnifiedCreatorsAction(
          {
            ...filtersToBrowseParams(mergedFilters, pageNum, PAGE_SIZE),
            searchSessionId: acquisitionSessionRef.current.getSessionId(),
            ...(options?.skipCoverageBackfill ? { skipCoverageBackfill: true } : {}),
          },
          {
            caller,
            requestId,
            acquisitionJobId: acquisitionPollJobRef.current[0] ?? null,
          }
        );
        if (controller.signal.aborted || requestId !== reqIdRef.current) return;
        pool = result.creators;
      }

      let filtered = useAiRelevance
        ? rankCreatorsByCampaignRelevance(pool, aiCriteriaRef.current, { minScore: 30 })
        : applyCreatorSearchClientFilters(pool, mergedFilters);
      filtered = dedupeCreatorsByPlatformHandle(filtered);
      for (const creator of filtered) {
        pinnedCreatorsRef.current.delete(creator.unified_id);
      }
      for (const pinned of pinnedCreatorsRef.current.values()) {
        filtered = upsertCreatorInResults(filtered, pinned).creators;
      }

      const latencyMs =
        searchStartedAtRef.current != null
          ? Math.round(performance.now() - searchStartedAtRef.current)
          : 0;

      startTransition(() => {
        const clientOnlyActive =
          !useAiRelevance && hasClientOnlyCreatorSearchFilters(mergedFilters);
        const displayTotal =
          filtered.length === 0
            ? 0
            : useAiRelevance
              ? filtered.length
              : clientOnlyActive && filtered.length < result.creators.length
                ? filtered.length
                : result.total;
        setTotal(displayTotal);
        setCreators((prev) => {
          const next = append ? [...prev, ...filtered] : filtered;
          const unique = new Map(next.map((c) => [c.unified_id, c]));
          return [...unique.values()];
        });
        setHasMore(
          useAiRelevance || showAcquiredOnly
            ? false
            : (result.has_more ?? pageNum * PAGE_SIZE < result.total)
        );

        const backfill = result.backfill;
        if (!append && backfill && !useAiRelevance) {
          if (
            backfill.acquisitionStarted &&
            (backfill.acquisitionJobIds?.length || backfill.acquisitionJobId) &&
            !options?.skipCoverageBackfill
          ) {
            startAcquisitionPollingRef.current(
              backfill.acquisitionJobIds ??
                (backfill.acquisitionJobId ? [backfill.acquisitionJobId] : []),
              requestId,
              mergedFilters
            );
            acquisitionSessionRef.current.startHeartbeat();
          } else if (backfill.completed && (backfill.profilesAdded ?? 0) > 0) {
            setBackfillStatus(
              `Added ${backfill.profilesAdded} creator${backfill.profilesAdded === 1 ? "" : "s"} from external discovery.`
            );
          } else if (backfill.apifyExecuted === false && filtered.length === 0) {
            setBackfillStatus(backfill.reason);
          } else if (
            filtered.length === 0 &&
            backfill.reason &&
            !backfill.acquisitionStarted
          ) {
            setBackfillStatus(backfill.reason);
          }
        }
      });

      if (
        !append &&
        !useAiRelevance &&
        filtered.length === 0 &&
        hasActiveCreatorSearchFilters(mergedFilters, queryAtFetch)
      ) {
        void fetchZeroResultRecommendations(mergedFilters, requestId);
      } else if (!append) {
        recommendationReqRef.current += 1;
        startTransition(() => {
          setRecommendedCreators([]);
          setLoadingRecommendations(false);
        });
      }

      if (!append && queryAtFetch.trim()) {
        const exactOnly =
          intentAtFetch.mode === "exact"
            ? filterExactCreatorMatches(filtered, queryAtFetch)
            : [];
        const resultsCount =
          intentAtFetch.mode === "exact"
            ? exactOnly.length
            : filtered.length;

        analyticsRef.current?.trackSearchExecuted({
          query: queryAtFetch,
          intentMode: intentAtFetch.mode,
          confidence: intentAtFetch.confidence,
          resultsCount,
          latencyMs,
        });
      }
    } catch (err) {
      if (controller.signal.aborted || requestId !== reqIdRef.current) return;
      const message = err instanceof Error ? err.message : "Search failed";
      startTransition(() => {
        if (!append) setError(message);
      });
      toast.error(message);
    } finally {
      if (requestId !== reqIdRef.current) return;
      startTransition(() => {
        setLoading(false);
        setLoadingMore(false);
      });
    }
  }, [searchTaxonomy, startTransition, stopAcquisitionPolling, fetchZeroResultRecommendations]);

  fetchPageRef.current = fetchPage;

  useEffect(() => {
    const session = acquisitionSessionRef.current;

    const onBeforeUnload = () => {
      session.dispose();
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Stop heartbeat first — do not leave a timer firing server actions after unmount.
      session.stopHeartbeat();
      void session.cancelSession();
    };
  }, []);

  const headerTotal = useMemo(() => {
    if (displayCreators.length === 0 && (acquisitionPolling || (!loading && !loadingMore))) {
      return 0;
    }
    return isExactCreatorSearch ? resultCount : total;
  }, [
    acquisitionPolling,
    displayCreators.length,
    isExactCreatorSearch,
    loading,
    loadingMore,
    resultCount,
    total,
  ]);

  useEffect(() => {
    analyticsRef.current = createDiscoverySearchAnalyticsTracker();
    return () => {
      stopAcquisitionPolling();
      analyticsRef.current?.dispose();
      analyticsRef.current = null;
    };
  }, [stopAcquisitionPolling]);

  useEffect(() => {
    analyticsRef.current?.trackQueryCleared(debouncedSearch);
  }, [debouncedSearch]);

  const runSearch = useCallback(
    (immediateQuery?: string) => {
      if (loading) return;
      if (typeof immediateQuery === "string") {
        const normalizedQuery = normalizeDiscoverySearchQuery(immediateQuery);
        searchRef.current = normalizedQuery;
        setDebouncedSearch(normalizedQuery);
      }
      setPage(1);
      setHasMore(true);
      clearCreatorSelection();
      void fetchPageRef.current(1, false, undefined, { caller: "explicit_run_search" });
    },
    [loading]
  );

  useEffect(() => {
    if (skipNextFilterFetchRef.current) {
      skipNextFilterFetchRef.current = false;
      return;
    }
    setPage(1);
    setHasMore(true);
    void fetchPageRef.current(1, false, undefined, { caller: "filter_sync" });
  }, [filters, debouncedSearch]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (page <= 1 || aiModeActive) return;
    void fetchPageRef.current(page, true, undefined, { caller: "pagination" });
  }, [page, aiModeActive]);

  // Refetch when an import completes (same tab or another tab via localStorage).
  useEffect(() => {
    function refreshAfterImport() {
      setPage(1);
      void fetchPageRef.current(1, false, undefined, { caller: "import_refresh" });
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
  }, []);

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

  const handleToggleSelect = useCallback((creator: UnifiedCreatorResult) => {
    toggle(creator.unified_id);
    setSelectedCreatorMap((prev) => {
      const next = new Map(prev);
      if (next.has(creator.unified_id)) next.delete(creator.unified_id);
      else next.set(creator.unified_id, creator);
      return next;
    });
  }, [toggle]);

  const handleToggleSelectAll = useCallback(() => {
    const allSelected =
      visibleCreatorIds.length > 0 && visibleCreatorIds.every((id) => selectedIds.has(id));
    toggleAllVisible(visibleCreatorIds);
    setSelectedCreatorMap((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        for (const id of visibleCreatorIds) next.delete(id);
      } else {
        for (const creator of displayCreators) {
          if (visibleCreatorIds.includes(creator.unified_id)) {
            next.set(creator.unified_id, creator);
          }
        }
      }
      return next;
    });
  }, [displayCreators, selectedIds, toggleAllVisible, visibleCreatorIds]);

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
        if (outcome.added > 0 || outcome.alreadyOnList > 0) {
          setShortlistMembership((prev) => {
            const next = new Map(prev);
            for (const creator of targets) {
              const existing = next.get(creator.unified_id) ?? [];
              next.set(creator.unified_id, [...new Set([...existing, ...shortlistIds])]);
            }
            return next;
          });
        }
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

  const handleToggleShortlist = useCallback(
    (creator: UnifiedCreatorResult) => {
      const membership = shortlistMembership.get(creator.unified_id);
      if (membership && membership.length > 0) {
        startTransition(async () => {
          try {
            const outcome = await removeUnifiedCreatorFromShortlists(membership, {
              unified_id: creator.unified_id,
              influencer_id: creator.influencer_id,
              discovered_profile_id: creator.discovered_profile_id,
            });
            setShortlistMembership((prev) => {
              const next = new Map(prev);
              next.delete(creator.unified_id);
              return next;
            });
            if (outcome.removed > 0) {
              toast.success("Removed from shortlist");
            } else if (outcome.firstError) {
              toast.error(outcome.firstError);
            } else {
              toast.info("Removed from shortlist");
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to remove from shortlist");
          }
        });
        return;
      }

      if (needsPlatformAccountSelection(creator)) {
        setPendingShortlistCreator(creator);
        setPlatformSelectOpen(true);
        return;
      }
      openAddToShortlistModal([creator]);
    },
    // openAddToShortlistModal is a stable function declaration in this component body
    [shortlistMembership]
  );

  const handleRejectCreator = useCallback((creator: UnifiedCreatorResult) => {
    if (creator.influencer_id) {
      setDeleteCreatorTarget(creator);
      return;
    }

    setHiddenUnifiedIds((prev) => {
      const next = new Set(prev);
      next.add(creator.unified_id);
      return next;
    });
    setSelectedIds((prev) => {
      if (!prev.has(creator.unified_id)) return prev;
      const next = new Set(prev);
      next.delete(creator.unified_id);
      return next;
    });
    toast.info("Removed from results");
  }, [setSelectedIds]);

  const handleAddCreatorToList = useCallback((creator: UnifiedCreatorResult) => {
    handleToggleShortlist(creator);
  }, [handleToggleShortlist]);

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

  function syncDiscoverySearchQuery(query: string) {
    const normalized = normalizeDiscoverySearchQuery(query);
    if (!normalized || searchRef.current === normalized) return;
    searchRef.current = normalized;
    setDebouncedSearch(normalized);
  }

  function upsertCreatorInList(next: UnifiedCreatorResult) {
    pinnedCreatorsRef.current.set(next.unified_id, next);
    setCreators((prev) => upsertCreatorInResults(prev, next).creators);
    setTotal((prev) => Math.max(prev, 1));
  }

  function patchCreatorInList(next: UnifiedCreatorResult) {
    upsertCreatorInList(next);
  }

  function handleMissingCreatorAdded(creator: UnifiedCreatorResult) {
    analyticsRef.current?.trackAddMissingCreator({
      query: debouncedSearch,
      intentMode: searchIntent.mode,
      confidence: searchIntent.confidence,
    });

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

  function handleCreatorDeleted(creator: UnifiedCreatorResult) {
    pinnedCreatorsRef.current.delete(creator.unified_id);
    setCreators((prev) => prev.filter((row) => row.unified_id !== creator.unified_id));
    setTotal((prev) => Math.max(0, prev - 1));
    setSelectedIds((prev) => {
      if (!prev.has(creator.unified_id)) return prev;
      const next = new Set(prev);
      next.delete(creator.unified_id);
      return next;
    });
    setSelectedCreatorMap((prev) => {
      if (!prev.has(creator.unified_id)) return prev;
      const next = new Map(prev);
      next.delete(creator.unified_id);
      return next;
    });
    closeIfShowing(creator.unified_id);
    router.refresh();
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

    requestManualRefresh({
      influencerId,
      unifiedId,
      scope: "metrics",
      platformAccountId,
      refreshAction: (id, dataSource) =>
        platformAccountId
          ? refreshCreatorPlatformAction(id, platformAccountId, "metrics", dataSource)
          : refreshCreatorAction(id, dataSource),
      onStatusChange: (status) => {
        patchCreatorEnrichmentStatus(unifiedId, status);
      },
      onCreatorUpdated: (updated) => {
        patchCreatorInList(updated);
      },
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

  const clearAllFilters = useCallback(() => {
    pendingUrlClearRef.current = "all";
    suppressBriefHydrationRef.current = true;
    initialBriefSearchDoneRef.current = false;

    abortRef.current?.abort();
    reqIdRef.current += 1;
    void cancelActiveAcquisitionSession();
    acquisitionRefreshedForJobRef.current = null;
    pinnedCreatorsRef.current.clear();

    sessionAcquiredInfluencerIdsRef.current = [];
    setApifySourceUnifiedIds(new Set());

    const cleared = cloneCreatorSearchFilters();
    filtersRef.current = cleared;
    searchRef.current = "";
    skipSearchUrlWriteRef.current = true;
    skipFilterUrlWriteRef.current = true;

    setFilters(cleared);
    setDebouncedSearch("");
    clearDiscoverySearchDraft();
    setCreators([]);
    setTotal(0);
    setError(null);
    setAiCriteria([]);
    setAiModeActive(false);
    setAiExtracting(false);
    setStrategySheetOpen(false);
    setBriefWorkspaceState(null);
    setBriefFileName(null);
    setActiveProfileId(null);
    setActiveProfile(null);
    setSort(DEFAULT_CREATOR_SEARCH_SORT);
    setBackfillStatus(null);
    setRecommendedCreators([]);
    setLoadingRecommendations(false);
    recommendationReqRef.current += 1;
    setPage(1);
    setHasMore(true);
    setFilterResetKey((key) => key + 1);
    clearCreatorSelection();

    const params = new URLSearchParams(searchParams.toString());
    params.delete(CREATOR_SEARCH_QUERY_PARAM);
    params.delete("profileId");
    params.delete("mode");
    params.delete("brief");
    applyCreatorSearchFiltersToUrlParams(params, cleared);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
    setFiltersDrawerOpen(false);
  }, [cancelActiveAcquisitionSession, pathname, router, searchParams]);

  const applyAiProfileFilters = useCallback(
    (profile: CampaignIntelligenceProfile, criteria?: CampaignSearchCriterion[]) => {
      sessionAcquiredInfluencerIdsRef.current = [];
      setApifySourceUnifiedIds(new Set());
      void cancelActiveAcquisitionSession();
      const chipCriteria = criteria ?? buildSearchStrategyFromProfile(profile);
      const nextFilters = buildCreatorFiltersFromProfile(profile, chipCriteria);

      aiModeRef.current = true;
      aiCriteriaRef.current = chipCriteria;
      filtersRef.current = nextFilters;
      skipNextFilterFetchRef.current = true;

      setAiCriteria(chipCriteria);
      setFilters(nextFilters);
      setDebouncedSearch("");
      skipSearchUrlWriteRef.current = true;
      setSort({ field: "relevance", direction: "desc" });
      setAiModeActive(true);
      setPage(1);
      setHasMore(false);
      setCreators([]);
      setTotal(0);
      setLoading(true);
      setError(null);
      clearCreatorSelection();

      void fetchPageRef.current(1, false, nextFilters, {
        caller: "ai_brief_search",
        skipCoverageBackfill: true,
      });
    },
    [clearCreatorSelection, cancelActiveAcquisitionSession]
  );

  const handleRemoveAiCriterion = useCallback(
    (id: string) => {
      const next = aiCriteria.filter((c) => c.id !== id);
      setAiCriteria(next);
      if (next.length === 0) {
        clearAllFilters();
        return;
      }
      if (!activeProfile) return;
      applyAiProfileFilters(activeProfile, next);
    },
    [activeProfile, aiCriteria, applyAiProfileFilters, clearAllFilters]
  );

  function handleSaveSearch() {
    try {
      localStorage.setItem(
        SAVED_SEARCH_KEY,
        JSON.stringify({ search: debouncedSearch, filters, savedAt: new Date().toISOString() })
      );
      toast.success("Search saved on this device");
    } catch {
      toast.error("Could not save search");
    }
  }

  const handleOpenCreator = useCallback(
    (creator: UnifiedCreatorResult) => {
      analyticsRef.current?.trackCreatorClicked({
        query: debouncedSearch,
        intentMode: searchIntent.mode,
        confidence: searchIntent.confidence,
        creatorUnifiedId: creator.unified_id,
      });
      openCreator(creator);
    },
    [debouncedSearch, openCreator, searchIntent.confidence, searchIntent.mode]
  );

  const handleSearchWithFewerWords = useCallback(() => {
    const simplified = simplifyCreatorSearchQuery(debouncedSearch);
    if (!simplified) return;
    runSearch(simplified);
  }, [debouncedSearch, runSearch]);

  const syncBriefUrl = useCallback(
    (profileId?: string | null, options?: { aiMode?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("brief");
      const pid = profileId ?? activeProfileId;
      if (pid) {
        params.set("profileId", pid);
      } else {
        params.delete("profileId");
      }
      if (options?.aiMode) {
        params.set("mode", "ai");
      } else if (options?.aiMode === false) {
        params.delete("mode");
      }
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      const currentQuery = searchParams.toString();
      const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
      if (nextUrl !== currentUrl) {
        router.replace(nextUrl, { scroll: false });
      }
    },
    [activeProfileId, pathname, router, searchParams]
  );

  const activateAiCampaignSearch = useCallback(
    (profile: CampaignIntelligenceProfile, profileId: string, fileName: string | null) => {
      suppressBriefHydrationRef.current = false;
      setBriefWorkspaceState((prev) =>
        prev?.profileId === profileId
          ? prev
          : {
              profileId,
              profile,
              fileName,
              fileSizeBytes: prev?.fileSizeBytes ?? null,
              hasExtractedData: true,
              parsedTextLength: 0,
              parsedTextPreview: "",
            }
      );
      setBriefFileName(fileName);
      setActiveProfileId(profileId);
      setActiveProfile(profile);
      const criteria = buildSearchStrategyFromProfile(profile);
      syncBriefUrl(profileId, { aiMode: true });
      applyAiProfileFilters(profile, criteria);
      setAiExtracting(true);
      setBriefSidebarOpen(false);
    },
    [applyAiProfileFilters, syncBriefUrl]
  );

  const handleBriefAnalyzed = useCallback(
    (state: CampaignIntelligenceWorkspaceState) => {
      activateAiCampaignSearch(state.profile, state.profileId, state.fileName);
    },
    [activateAiCampaignSearch]
  );

  useEffect(() => {
    if (!initialBriefState || suppressBriefHydrationRef.current) return;
    if (initialBriefSearchDoneRef.current) return;
    initialBriefSearchDoneRef.current = true;
    activateAiCampaignSearch(
      initialBriefState.profile,
      initialBriefState.profileId,
      initialBriefState.fileName
    );
  }, [activateAiCampaignSearch, initialBriefState]);

  const handleBriefCleared = useCallback(() => {
    suppressBriefHydrationRef.current = true;
    setBriefWorkspaceState(null);
    setBriefFileName(null);
    setActiveProfileId(null);
    setActiveProfile(null);
    setAiCriteria([]);
    setAiModeActive(false);
    setAiExtracting(false);
    setFilters(cloneCreatorSearchFilters());
    setPage(1);
    setHasMore(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("brief");
    params.delete("profileId");
    params.delete("mode");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const handleBriefWorkspaceChange = useCallback(
    (state: CampaignIntelligenceWorkspaceState) => {
      suppressBriefHydrationRef.current = false;
      setBriefWorkspaceState(state);
      setBriefFileName(state.fileName);
      setActiveProfileId(state.profileId);
      setActiveProfile(state.profile);
      setAiCriteria(buildSearchStrategyFromProfile(state.profile));
      syncBriefUrl(state.profileId);
    },
    [syncBriefUrl]
  );

  const handleUseAiCampaign = useCallback(() => {
    if (!activeProfile || !activeProfileId) {
      toast.info("Add a campaign brief first.");
      setBriefSidebarOpen(true);
      return;
    }
    activateAiCampaignSearch(activeProfile, activeProfileId, briefFileName);
  }, [activateAiCampaignSearch, activeProfile, activeProfileId, briefFileName]);

  useEffect(() => {
    if (!aiExtracting) return;
    if (!loading) setAiExtracting(false);
  }, [aiExtracting, loading]);

  const handleRunAiSearch = useCallback(() => {
    if (!activeProfile) {
      toast.info("Add a campaign brief first.");
      return;
    }
    applyAiProfileFilters(activeProfile, aiCriteria);
    setStrategySheetOpen(false);
  }, [activeProfile, aiCriteria, applyAiProfileFilters]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {briefSidebarOpen ? (
        <CampaignBriefSidebar
          open={briefSidebarOpen}
          onOpenChange={setBriefSidebarOpen}
          initialState={briefWorkspaceState}
          onWorkspaceChange={handleBriefWorkspaceChange}
          onBriefCleared={handleBriefCleared}
          onRunAiSearch={handleUseAiCampaign}
          onBriefAnalyzed={handleBriefAnalyzed}
        />
      ) : null}

      {activeProfile && aiModeActive ? (
        <CreatorSearchCampaignRequirementsPanel
          profile={activeProfile}
          fileName={briefFileName}
          onEdit={() => setBriefSidebarOpen(true)}
        />
      ) : null}

      {strategySheetOpen ? (
        <AiSearchStrategySheet
          open={strategySheetOpen}
          onOpenChange={setStrategySheetOpen}
          criteria={aiCriteria}
          onCriteriaChange={setAiCriteria}
          onRunSearch={handleRunAiSearch}
          running={loading || isPending}
        />
      ) : null}

      {aiModeActive && aiCriteria.some((c) => c.enabled) ? (
        <CreatorSearchAiCriteriaChips
          criteria={aiCriteria}
          onRemove={handleRemoveAiCriterion}
          onEditStrategy={() => setStrategySheetOpen(true)}
        />
      ) : (
        <CreatorSearchActiveFilters
          filters={filters}
          search={debouncedSearch}
          onChange={setFilters}
          onClearSearch={handleClearSearch}
          onClearAll={clearAllFilters}
        />
      )}

      {backfillStatus ? (
        <p className="border-b border-border/60 bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          {backfillStatus}
        </p>
      ) : null}

      <CreatorSearchBulkBar
        selectedCount={selectedCreators.length}
        onClearSelection={clearCreatorSelection}
        onAddToList={handleBulkAddToList}
        onCreateList={() => setCreateListOpen(true)}
        onCompare={handleBulkCompare}
        onExport={handleBulkExport}
        onShare={handleBulkShare}
        onGenerateQuotation={handleGenerateQuotation}
        onRefreshMetrics={handleBulkRefreshMetrics}
        onStopRefresh={handleBulkStopRefresh}
        stopRefreshDisabled={selectedInFlightCreators.length === 0}
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
          "relative flex min-h-0 flex-1 overflow-hidden",
          discoverySelectionFlyoutContentClass(selectedCreators.length > 0)
        )}
      >
        {aiExtracting ? (
          <CreatorSearchAiExtractingState className="absolute inset-0 z-10 bg-card" />
        ) : null}
        <CreatorSearchResultList
          creators={displayCreators}
          hybridListItems={hybridListItems}
          searchMode={searchIntent.mode}
          sort={sort}
          onSortChange={setSort}
          platformFilter={filters.platforms}
          loading={loading && displayCreators.length === 0}
          loadingMore={loadingMore}
          hasMore={isExactCreatorSearch || aiModeActive ? false : hasMore}
          error={error}
          total={headerTotal}
          apifySourceUnifiedIds={apifySourceUnifiedIds}
          showCampaignRelevance={showCampaignRelevance}
          selectedIds={selectedIds}
          shortlistedIds={shortlistedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onOpenCreator={handleOpenCreator}
          onToggleShortlist={handleToggleShortlist}
          onRejectCreator={handleRejectCreator}
          onRefreshMetrics={handleRefreshMetricsForCreator}
          onStopRefresh={handleStopRefreshForCreator}
          onStopAllRefresh={handleStopAllRefresh}
          inFlightCount={inFlightCreators.length}
          onRetry={() => runSearch()}
          loadMoreRef={loadMoreRef}
          showAddMissingCreator={
            debouncedSearch.trim().length > 0 && !exactCreatorZeroMatch
          }
          exactCreatorEmptyState={exactCreatorZeroMatch}
          searchQuery={debouncedSearch}
          canSimplifyExactQuery={canSimplifyExactQuery}
          onSearchWithFewerWords={handleSearchWithFewerWords}
          onMissingCreatorAdded={handleMissingCreatorAdded}
          onMissingCreatorEnrichmentStatusChange={patchCreatorEnrichmentStatus}
          onMissingCreatorUpdated={handleMissingCreatorUpdated}
          onCreatorDeleted={handleCreatorDeleted}
          showExactMatchesZeroHeader={showZeroResultsRecommendations}
          recommendations={visibleRecommendations}
          loadingRecommendations={loadingRecommendations}
          toolbar={{
            searchQuery: debouncedSearch,
            onDebouncedSearchChange: handleDebouncedSearchChange,
            onSearchSubmit: (query) => runSearch(query),
            searchLoading: loading || isPending,
            sort,
            onSortChange: setSort,
            filters,
            onFiltersChange: setFilters,
            onOpenFilters: () => setFiltersDrawerOpen(true),
            showCampaignRelevance,
          }}
        />
      </div>

      <DiscoveryFilterSheet open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
          <CreatorSearchFilterPanel
            key={filterResetKey}
            open={filtersDrawerOpen}
            filters={filters}
            onApply={setFilters}
            onClearAll={clearAllFilters}
            onClose={() => setFiltersDrawerOpen(false)}
            loading={loading || isPending}
          />
      </DiscoveryFilterSheet>

      <CreatorDetailSheet
        key={detailOpen && detailCreator ? detailCreator.unified_id : "closed"}
        creator={detailCreator}
        open={detailOpen}
        onOpenChange={onDetailOpenChange}
        onCreatorUpdated={patchCreatorInList}
      />

      {createListOpen ? (
        <CreateListDialog
          open={createListOpen}
          onOpenChange={setCreateListOpen}
          campaigns={campaigns}
          onCreated={handleListCreated}
        />
      ) : null}

      {platformSelectOpen ? (
        <SelectPlatformAccountsDialog
          open={platformSelectOpen}
          onOpenChange={(open) => {
            setPlatformSelectOpen(open);
            if (!open) setPendingShortlistCreator(null);
          }}
          creator={pendingShortlistCreator}
          onConfirm={handleConfirmPlatformAccounts}
        />
      ) : null}

      {addToShortlistOpen ? (
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
      ) : null}

      {manualRefreshDialogOpen ? (
        <ManualRefreshConfirmDialog
          open={manualRefreshDialogOpen}
          onOpenChange={setManualRefreshDialogOpen}
          assessment={manualRefreshAssessment}
          scopeLabel={manualRefreshScopeLabel}
          isSubmitting={manualRefreshPending}
          onChoose={chooseManualRefreshSource}
        />
      ) : null}

      {deleteCreatorTarget ? (
        <DeleteDiscoveryCreatorDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteCreatorTarget(null);
          }}
          creator={deleteCreatorTarget}
          onDeleted={() => {
            handleCreatorDeleted(deleteCreatorTarget);
            setDeleteCreatorTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
