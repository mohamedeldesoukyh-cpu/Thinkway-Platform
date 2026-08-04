/**
 * Progressive load phases for Studio + Creator Detail.
 * Does not drop data — only stages when it mounts / fetches.
 */

export type ProgressiveLoadPhase = 1 | 2 | 3;

/** Studio sections needed for first meaningful paint (brief + slate chrome). */
export const STUDIO_PHASE1_SECTION_IDS = [
  "campaign-summary",
  "creator-recommendations",
] as const;

/** Recommendation / strategy detail — target under ~1s. */
export const STUDIO_PHASE2_SECTION_IDS = [
  "executive-strategy",
  "creator-discovery",
  "creator-mix",
  "why-ai",
  "creative-concepts",
  "budget-planner",
] as const;

/** Heavy forecast / diagnostics / sign-off — viewport or idle. */
export const STUDIO_PHASE3_SECTION_IDS = [
  "content-plan",
  "timeline",
  "kpi-forecast",
  "success-probability",
  "industry-benchmark",
  "risk-analysis",
  "opportunity-finder",
  "executive-summary",
  "presentation-status",
] as const;

const PHASE1 = new Set<string>(STUDIO_PHASE1_SECTION_IDS);
const PHASE2 = new Set<string>(STUDIO_PHASE2_SECTION_IDS);

export function studioSectionProgressivePhase(sectionId: string): ProgressiveLoadPhase {
  if (PHASE1.has(sectionId)) return 1;
  if (PHASE2.has(sectionId)) return 2;
  return 3;
}

/**
 * @deprecated Viewport hydration replaces fixed first-N batches.
 * Kept only for soak script adaptive comparisons — prefer
 * `estimateViewportHydrationSeedCount` / IntersectionObserver.
 */
export const STUDIO_HYDRATION_PHASE1_COUNT = 6;

/** Delay before mounting phase-2 Studio section bodies (ms). */
export const STUDIO_PHASE2_MOUNT_DELAY_MS = 120;

/** Delay before allowing phase-3 force-mount outside viewport (ms). */
export const STUDIO_PHASE3_MOUNT_DELAY_MS = 450;

export type LoadTimingMark = {
  name: string;
  startedAt: number;
  durationMs: number;
  meta?: Record<string, string | number | boolean | null>;
};

export function startLoadTimer(name: string): { end: (meta?: LoadTimingMark["meta"]) => LoadTimingMark } {
  const startedAt = performance.now();
  return {
    end(meta) {
      const mark: LoadTimingMark = {
        name,
        startedAt,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        meta,
      };
      if (process.env.NEXT_PUBLIC_DEBUG_LOAD_TIMING === "1") {
        console.log("[load-timing]", JSON.stringify(mark));
      }
      return mark;
    },
  };
}

/** Server-safe wall-clock helper (Node / edge). */
export function startServerLoadTimer(name: string): {
  end: (meta?: LoadTimingMark["meta"]) => LoadTimingMark;
} {
  const startedAt = Date.now();
  return {
    end(meta) {
      const mark: LoadTimingMark = {
        name,
        startedAt,
        durationMs: Date.now() - startedAt,
        meta,
      };
      if (process.env.DEBUG_LOAD_TIMING === "1" || process.env.NEXT_PUBLIC_DEBUG_LOAD_TIMING === "1") {
        console.log("[load-timing]", JSON.stringify(mark));
      }
      return mark;
    },
  };
}
