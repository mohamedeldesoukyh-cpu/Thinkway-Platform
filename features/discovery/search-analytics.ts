"use client";

import {
  logDiscoverySearchAnalyticsAction,
  type DiscoverySearchAnalyticsPayload,
} from "@/features/discovery/search-analytics-actions";
import type { CreatorSearchIntentMode } from "@/features/discovery/components/creator-search/creator-search-intent-engine";

const FLUSH_DEBOUNCE_MS = 1200;
const ABANDON_DEBOUNCE_MS = 2500;

type PendingSearchContext = {
  query: string;
  intentMode: CreatorSearchIntentMode;
  confidence: number;
  resultsCount: number;
  latencyMs: number;
  creatorClicked: boolean;
  addMissingCreator: boolean;
};

export type DiscoverySearchAnalyticsTracker = {
  trackSearchExecuted: (input: {
    query: string;
    intentMode: CreatorSearchIntentMode;
    confidence: number;
    resultsCount: number;
    latencyMs: number;
  }) => void;
  trackCreatorClicked: (input: {
    query: string;
    intentMode: CreatorSearchIntentMode;
    confidence: number;
    creatorUnifiedId: string;
  }) => void;
  trackAddMissingCreator: (input: {
    query: string;
    intentMode: CreatorSearchIntentMode;
    confidence: number;
  }) => void;
  trackQueryCleared: (query: string) => void;
  flush: () => void;
  dispose: () => void;
};

export function createDiscoverySearchAnalyticsTracker(): DiscoverySearchAnalyticsTracker {
  let pending: DiscoverySearchAnalyticsPayload[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let abandonTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSearch: PendingSearchContext | null = null;

  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  function enqueue(event: DiscoverySearchAnalyticsPayload) {
    pending.push(event);
    scheduleFlush();
  }

  function clearAbandonTimer() {
    if (abandonTimer) {
      clearTimeout(abandonTimer);
      abandonTimer = null;
    }
  }

  function scheduleAbandoned() {
    clearAbandonTimer();
    if (!lastSearch || lastSearch.creatorClicked || lastSearch.addMissingCreator) return;

    abandonTimer = setTimeout(() => {
      abandonTimer = null;
      if (!lastSearch || lastSearch.creatorClicked || lastSearch.addMissingCreator) return;
      enqueue({
        eventType: "search_abandoned",
        query: lastSearch.query,
        intentMode: lastSearch.intentMode,
        confidence: lastSearch.confidence,
        latencyMs: lastSearch.latencyMs,
        resultsCount: lastSearch.resultsCount,
      });
      lastSearch = null;
    }, ABANDON_DEBOUNCE_MS);
  }

  async function flush() {
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    try {
      await logDiscoverySearchAnalyticsAction(batch);
    } catch {
      // Analytics must never block search UX.
    }
  }

  return {
    trackSearchExecuted(input) {
      clearAbandonTimer();
      lastSearch = {
        query: input.query,
        intentMode: input.intentMode,
        confidence: input.confidence,
        resultsCount: input.resultsCount,
        latencyMs: input.latencyMs,
        creatorClicked: false,
        addMissingCreator: false,
      };
      enqueue({
        eventType: "search_executed",
        query: input.query,
        intentMode: input.intentMode,
        confidence: input.confidence,
        latencyMs: input.latencyMs,
        resultsCount: input.resultsCount,
      });
    },

    trackCreatorClicked(input) {
      if (lastSearch?.query === input.query) {
        lastSearch.creatorClicked = true;
      }
      clearAbandonTimer();
      enqueue({
        eventType: "creator_clicked",
        query: input.query,
        intentMode: input.intentMode,
        confidence: input.confidence,
        creatorUnifiedId: input.creatorUnifiedId,
      });
    },

    trackAddMissingCreator(input) {
      if (lastSearch?.query === input.query) {
        lastSearch.addMissingCreator = true;
      }
      clearAbandonTimer();
      enqueue({
        eventType: "add_missing_creator",
        query: input.query,
        intentMode: input.intentMode,
        confidence: input.confidence,
      });
    },

    trackQueryCleared(query) {
      if (!query.trim()) {
        scheduleAbandoned();
        return;
      }
      clearAbandonTimer();
    },

    flush() {
      clearAbandonTimer();
      void flush();
    },

    dispose() {
      clearAbandonTimer();
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (lastSearch && !lastSearch.creatorClicked && !lastSearch.addMissingCreator) {
        enqueue({
          eventType: "search_abandoned",
          query: lastSearch.query,
          intentMode: lastSearch.intentMode,
          confidence: lastSearch.confidence,
          latencyMs: lastSearch.latencyMs,
          resultsCount: lastSearch.resultsCount,
        });
        lastSearch = null;
      }
      void flush();
    },
  };
}
