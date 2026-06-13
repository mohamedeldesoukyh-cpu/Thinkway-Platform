"use client";

import { useCallback, useEffect, useState } from "react";

import {
  REPORT_HUB_LINK_IDS,
  type ReportHubLinkId,
} from "@/lib/reports/report-hub-links";
import {
  normalizeReportsHubFavorites,
  normalizeReportsHubOrder,
  normalizeReportsHubViewMode,
  reorderReportsHubLinks,
  REPORTS_HUB_PREFERENCES_STORAGE_KEY,
  toggleReportsHubFavorite,
  type ReportsHubPreferences,
  type ReportsHubViewMode,
} from "@/lib/reports/reports-hub-preferences";

const DEFAULT_ORDER: ReportHubLinkId[] = [...REPORT_HUB_LINK_IDS];

function readStoredPreferences(): ReportsHubPreferences {
  try {
    const raw = localStorage.getItem(REPORTS_HUB_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { favorites: [], order: DEFAULT_ORDER, viewMode: "all" };
    }

    const parsed = JSON.parse(raw) as Partial<ReportsHubPreferences>;
    const order = normalizeReportsHubOrder(parsed.order, DEFAULT_ORDER);
    const favorites = normalizeReportsHubFavorites(parsed.favorites, order);
    const viewMode = normalizeReportsHubViewMode(parsed.viewMode);
    return { favorites, order, viewMode };
  } catch {
    return { favorites: [], order: DEFAULT_ORDER, viewMode: "all" };
  }
}

function writeStoredPreferences(preferences: ReportsHubPreferences) {
  try {
    localStorage.setItem(
      REPORTS_HUB_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences)
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function useReportsHubPreferences() {
  const [preferences, setPreferences] = useState<ReportsHubPreferences>({
    favorites: [],
    order: DEFAULT_ORDER,
    viewMode: "all",
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPreferences(readStoredPreferences());
    setHydrated(true);
  }, []);

  const persistPreferences = useCallback(
    (updater: (current: ReportsHubPreferences) => ReportsHubPreferences) => {
      setPreferences((current) => {
        const next = updater(current);
        const order = normalizeReportsHubOrder(next.order, DEFAULT_ORDER);
        const favorites = normalizeReportsHubFavorites(next.favorites, order);
        const viewMode = normalizeReportsHubViewMode(next.viewMode);
        const normalized = { favorites, order, viewMode };
        writeStoredPreferences(normalized);
        return normalized;
      });
    },
    []
  );

  const moveReport = useCallback(
    (fromIndex: number, toIndex: number) => {
      persistPreferences((current) => ({
        ...current,
        order: reorderReportsHubLinks(current.order, fromIndex, toIndex),
      }));
    },
    [persistPreferences]
  );

  const toggleFavorite = useCallback(
    (id: ReportHubLinkId) => {
      persistPreferences((current) => ({
        ...current,
        favorites: toggleReportsHubFavorite(current.favorites, id),
      }));
    },
    [persistPreferences]
  );

  const setViewMode = useCallback(
    (viewMode: ReportsHubViewMode) => {
      persistPreferences((current) => ({ ...current, viewMode }));
    },
    [persistPreferences]
  );

  const resetPreferences = useCallback(() => {
    persistPreferences(() => ({
      favorites: [],
      order: DEFAULT_ORDER,
      viewMode: "all",
    }));
  }, [persistPreferences]);

  return {
    favorites: preferences.favorites,
    order: preferences.order,
    viewMode: preferences.viewMode,
    favoriteSet: new Set(preferences.favorites),
    moveReport,
    toggleFavorite,
    setViewMode,
    resetPreferences,
    hydrated,
  };
}
