import type { CommercialBenchmarkSupport } from "@/lib/enterprise-creator-intelligence/commercial/types";

const FUTURE_SLOT = (note: string) => ({
  value: null as number | null,
  available: false,
  note,
});

/**
 * Benchmark extension points for every metric.
 * Sprint 2 does not calculate Category / Market benchmarks — slots only.
 */
export function emptyBenchmarkSupport(): CommercialBenchmarkSupport {
  return {
    creator: FUTURE_SLOT(
      "Creator benchmark extension — fill from creator historical average when wired."
    ),
    campaign: FUTURE_SLOT(
      "Campaign benchmark extension — fill from campaign peer set when wired."
    ),
    category: FUTURE_SLOT(
      "Category benchmark extension — Sprint 3+ Category Intelligence."
    ),
    platform: FUTURE_SLOT(
      "Platform benchmark extension — fill from platform peer set when wired."
    ),
    market: FUTURE_SLOT(
      "Market benchmark extension — future; do not calculate in Sprint 2."
    ),
  };
}

/** Attach creator historical average as the only Sprint 2 creator benchmark when known. */
export function withCreatorBenchmark(
  base: CommercialBenchmarkSupport,
  creatorAverage: number | null
): CommercialBenchmarkSupport {
  if (creatorAverage == null || !Number.isFinite(creatorAverage)) return base;
  return {
    ...base,
    creator: {
      value: creatorAverage,
      available: true,
      note: "Creator historical average from append-only commercial / historical series.",
    },
  };
}
