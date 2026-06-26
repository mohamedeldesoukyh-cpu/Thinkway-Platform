"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { browseUnifiedCreatorsAction } from "@/features/campaigns/creator-discovery-actions";

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

export {
  buildExistingCreatorKeys,
  countCreatorSelection,
  creatorDedupKeys,
  deselectAllCreatorIds,
  deselectAllIds,
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
        const result = await browseUnifiedCreatorsAction({
          ...parsedFilters,
          page,
          pageSize,
        });
        if (id !== reqId.current) return;

        setState((prev) => {
          const merged = append ? [...prev.creators, ...result.creators] : result.creators;
          const unique = new Map(merged.map((c) => [c.unified_id, c]));
          const creators = [...unique.values()];
          return {
            creators,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            internalCount: result.internal_count,
            discoveryCount: result.discovery_count,
            loading: false,
            loadingMore: false,
            error: null,
            hasMore: page * pageSize < result.total,
          };
        });
      } catch (err) {
        if (id !== reqId.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: err instanceof Error ? err.message : "Search failed",
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
  };
}
