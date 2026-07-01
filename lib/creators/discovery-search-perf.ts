/**
 * Development-only timing for Discovery Search instrumentation.
 * Enable with NODE_ENV=development or DISCOVERY_SEARCH_PERF=1.
 */

export type DiscoverySearchPerfSpan = {
  label: string;
  startMs: number;
  endMs?: number;
};

export type DiscoverySearchPerfReport = {
  label: string;
  totalMs: number;
  spans: Array<{ label: string; ms: number }>;
};

export function isDiscoverySearchPerfEnabled(): boolean {
  if (process.env.DISCOVERY_SEARCH_PERF === "1") return true;
  return process.env.NODE_ENV === "development";
}

export function createDiscoverySearchPerf(label: string): {
  span: (name: string) => void;
  end: () => DiscoverySearchPerfReport | null;
} | null {
  if (!isDiscoverySearchPerfEnabled()) {
    return null;
  }

  const startedAt = performance.now();
  const spans: DiscoverySearchPerfSpan[] = [];
  let openSpan: DiscoverySearchPerfSpan | null = null;

  function closeOpenSpan(endMs: number): void {
    if (openSpan) {
      openSpan.endMs = endMs;
      spans.push(openSpan);
      openSpan = null;
    }
  }

  return {
    span(name: string) {
      const now = performance.now();
      closeOpenSpan(now);
      openSpan = { label: name, startMs: now };
    },
    end() {
      const endMs = performance.now();
      closeOpenSpan(endMs);
      const report: DiscoverySearchPerfReport = {
        label,
        totalMs: Math.round(endMs - startedAt),
        spans: spans.map((entry) => ({
          label: entry.label,
          ms: Math.round((entry.endMs ?? endMs) - entry.startMs),
        })),
      };
      // eslint-disable-next-line no-console -- dev-only perf instrumentation
      console.info(
        `[discovery-search-perf] ${report.label} ${report.totalMs}ms`,
        Object.fromEntries(report.spans.map((s) => [s.label, `${s.ms}ms`]))
      );
      return report;
    },
  };
}
