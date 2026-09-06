"use client";

import { useEffect, useRef, useState } from "react";

import {
  enrichmentStatusToRefreshProgress,
  isTerminalEnrichmentStatus,
  REFRESH_METRICS_OUTCOME_LINGER_MS,
  type RefreshMetricsProgressView,
} from "./refresh-metrics-progress";
import {
  isEnrichmentInProgress,
  resolveCreatorEnrichmentStatus,
  type CreatorEnrichmentStatus,
} from "./status";

/**
 * Shows live progress while refresh runs; keeps Done/Failed/Partial briefly
 * after the status flips terminal (or until the next refresh starts).
 */
export function useRefreshMetricsProgressCircle(input: {
  enrichmentStatus?: CreatorEnrichmentStatus | null;
  isPending?: boolean;
  lingerMs?: number;
}): RefreshMetricsProgressView | null {
  const status = resolveCreatorEnrichmentStatus(input.enrichmentStatus);
  const isPending = Boolean(input.isPending);
  const lingerMs = input.lingerMs ?? REFRESH_METRICS_OUTCOME_LINGER_MS;

  const [showTerminal, setShowTerminal] = useState(false);
  const prevInFlightRef = useRef(false);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inFlight = isPending || isEnrichmentInProgress(status);

  useEffect(() => {
    if (inFlight) {
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
      setShowTerminal(false);
      prevInFlightRef.current = true;
      return;
    }

    if (prevInFlightRef.current && isTerminalEnrichmentStatus(status)) {
      setShowTerminal(true);
      lingerTimerRef.current = setTimeout(() => {
        setShowTerminal(false);
        lingerTimerRef.current = null;
      }, lingerMs);
    }
    prevInFlightRef.current = false;

    return () => {
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
    };
  }, [inFlight, lingerMs, status]);

  return enrichmentStatusToRefreshProgress(status, {
    isPending,
    includeTerminal: showTerminal,
  });
}
