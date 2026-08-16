"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { browseUnifiedCreatorsForPickerAction } from "@/features/campaigns/creator-discovery-actions";
import { filterExactCreatorMatches } from "@/features/discovery/components/creator-search/creator-search-exact-match";
import { mapDiscoverySearchError } from "@/lib/creators/discovery-search-error";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { upsertCreatorInResults } from "@/lib/discovery/creator-search-query";

import {
  CREATOR_PICKER_DEBOUNCE_MS,
  CREATOR_PICKER_DEFAULT_PAGE_SIZE,
  type CreatorBrowseFilters,
  type CreatorBrowseState,
  type CreatorPickerPaginationMode,
  type CreatorSelectionConfig,
  type CreatorSelectionMode,
} from "./creator-selection-types";
import {
  deselectAllCreatorIds,
  resolveCreatorCheckboxState,
  selectAllCreatorIds,
  toggleCreatorSelection,
  toggleSelectAllVisible,
} from "./creator-selection-utils";

function pinnedCreatorMatchesSearch(
  creator: UnifiedCreatorResult,
  searchQuery: string | undefined
): boolean {
  const trimmed = searchQuery?.trim() ?? "";
  if (!trimmed) return true;
  return filterExactCreatorMatches([creator], trimmed).length > 0;
}

function mergePinnedCreators(
  creators: UnifiedCreatorResult[],
  pinned: Map<string, UnifiedCreatorResult>,
  searchQuery: string | undefined
): UnifiedCreatorResult[] {
  let merged = creators;
  for (const creator of pinned.values()) {
    if (!pinnedCreatorMatchesSearch(creator, searchQuery)) continue;
    merged = upsertCreatorInResults(merged, creator).creators;
  }
  return merged;
}

export {
  buildExistingCreatorKeys,
  countCreatorSelection,
  creatorDedupKeys,
  deselectAllCreatorIds,
  deselectAllIds,
  existingKeysFromStandaloneShortlistItems,
  filterSelectedCreators,
  isCreatorOnExistingList,
  resolveCreatorCheckboxState,
  selectAllCreatorIds,
  selectAllIds,
  toggleCreatorSelection,
  toggleIdSelection,
  toggleSelectAllVisible,
} from "./creator-selection-utils";

export function useDebouncedValue<T>(value: T, delayMs = CREATOR_PICKER_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useCreatorSelection(config: CreatorSelectionConfig = { mode: "multi" }) {
  const { mode, maxSelection } = config;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback((ids: readonly string[]) => {
    setSelectedIds(selectAllCreatorIds(ids));
  }, []);

  const deselectAll = useCallback((ids: readonly string[]) => {
    setSelectedIds((prev) => deselectAllCreatorIds(ids, prev));
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        if (mode === "single") {
          return prev.has(id) ? new Set() : new Set([id]);
        }
        const next = toggleCreatorSelection(prev, id);
        if (maxSelection != null && next.size > maxSelection) return prev;
        return next;
      });
    },
    [mode, maxSelection]
  );

  const toggleAllVisible = useCallback((visibleIds: readonly string[]) => {
    setSelectedIds((prev) => toggleSelectAllVisible(visibleIds, prev));
  }, []);

  const checkboxState = useCallback(
    (visibleIds: readonly string[]) => resolveCreatorCheckboxState(visibleIds, selectedIds),
    [selectedIds]
  );

  return {
    selectedIds,
    setSelectedIds,
    selectedCount: selectedIds.size,
    clearSelection,
    selectAll,
    deselectAll,
    toggle,
    toggleAllVisible,
    checkboxState,
    mode: mode as CreatorSelectionMode,
  };
}

type UseCreatorBrowseOptions = {
  enabled?: boolean;
  filters?: CreatorBrowseFilters;
  pageSize?: number;
  paginationMode?: CreatorPickerPaginationMode;
  debounceMs?: number;
};

const INITIAL_BROWSE_STATE: CreatorBrowseState = {
  creators: [],
  total: 0,
  page: 1,
  pageSize: CREATOR_PICKER_DEFAULT_PAGE_SIZE,
  internalCount: 0,
  discoveryCount: 0,
  loading: false,
  loadingMore: false,
  error: null,
  hasMore: false,
};

export function useCreatorBrowse({
  enabled = true,
  filters = {},
  pageSize = CREATOR_PICKER_DEFAULT_PAGE_SIZE,
  paginationMode = "page",
  debounceMs = CREATOR_PICKER_DEBOUNCE_MS,
}: UseCreatorBrowseOptions = {}) {
  const [state, setState] = useState<CreatorBrowseState>(INITIAL_BROWSE_STATE);
  const reqId = useRef(0);
  const pinnedCreatorsRef = useRef<Map<string, UnifiedCreatorResult>>(new Map());
  const filtersKey = JSON.stringify(filters);
  const debouncedFiltersKey = useDebouncedValue(filtersKey, debounceMs);

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      const id = ++reqId.current;
      setState((prev) => ({
        ...prev,
        loading: !append,
        loadingMore: append,
        error: null,
      }));

      try {
        const parsedFilters = JSON.parse(debouncedFiltersKey) as CreatorBrowseFilters;
        const result = await browseUnifiedCreatorsForPickerAction({
          ...parsedFilters,
          skipCoverageBackfill: true,
          page,
          pageSize,
        });
        if (id !== reqId.current) return;
        if (result.error) {
          throw new Error(result.error);
        }

        setState((prev) => {
          for (const creator of result.creators) {
            pinnedCreatorsRef.current.delete(creator.unified_id);
          }

          const searchQuery = parsedFilters.search;
          let mergedCreators = append ? [...prev.creators, ...result.creators] : result.creators;
          mergedCreators = mergePinnedCreators(
            mergedCreators,
            pinnedCreatorsRef.current,
            searchQuery
          );

          const unique = new Map(mergedCreators.map((c) => [c.unified_id, c]));
          const creators = [...unique.values()];
          return {
            creators,
            total: Math.max(result.total, creators.length),
            page: result.page,
            pageSize: result.pageSize,
            internalCount: result.internal_count,
            discoveryCount: result.discovery_count,
            loading: false,
            loadingMore: false,
            error: null,
            hasMore: page * pageSize < Math.max(result.total, creators.length),
          };
        });
      } catch (err) {
        if (id !== reqId.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: mapDiscoverySearchError(err),
        }));
      }
    },
    [debouncedFiltersKey, pageSize]
  );

  useEffect(() => {
    if (!enabled) return;
    setState((prev) => ({ ...prev, page: 1 }));
    void fetchPage(1, false);
  }, [enabled, debouncedFiltersKey, fetchPage]);

  const loadMore = useCallback(() => {
    if (!enabled || state.loading || state.loadingMore || !state.hasMore) return;
    const nextPage = state.page + 1;
    setState((prev) => ({ ...prev, page: nextPage }));
    void fetchPage(nextPage, paginationMode === "infinite");
  }, [enabled, state, fetchPage, paginationMode]);

  const goToPage = useCallback(
    (page: number) => {
      if (!enabled || page < 1) return;
      setState((prev) => ({ ...prev, page }));
      void fetchPage(page, false);
    },
    [enabled, fetchPage]
  );

  const retry = useCallback(() => {
    void fetchPage(state.page, false);
  }, [fetchPage, state.page]);

  const upsertCreator = useCallback((creator: UnifiedCreatorResult) => {
    pinnedCreatorsRef.current.set(creator.unified_id, creator);
    setState((prev) => {
      const { creators, inserted } = upsertCreatorInResults(prev.creators, creator);
      return {
        ...prev,
        creators,
        total: inserted ? Math.max(prev.total, creators.length, 1) : prev.total,
      };
    });
  }, []);

  const patchCreator = useCallback((creator: UnifiedCreatorResult) => {
    if (pinnedCreatorsRef.current.has(creator.unified_id)) {
      pinnedCreatorsRef.current.set(creator.unified_id, creator);
    }
    setState((prev) => {
      const index = prev.creators.findIndex((row) => row.unified_id === creator.unified_id);
      if (index < 0) return prev;
      const creators = [...prev.creators];
      creators[index] = creator;
      return { ...prev, creators };
    });
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(state.total / pageSize)),
    [state.total, pageSize]
  );

  return {
    ...state,
    totalPages,
    loadMore,
    goToPage,
    retry,
    refetch: () => void fetchPage(1, false),
    upsertCreator,
    patchCreator,
  };
}
