import { emptyFinancialMetrics } from "@/lib/analytics/metrics/financial";
import { devLog } from "@/lib/platform/logger";
import type { CampaignAnalyticsFact } from "@/lib/analytics/types/metrics";

export function emptyAnalyticsKpiMetrics() {
  return emptyFinancialMetrics();
}

export type SafeAnalyticsResult<T> = {
  data: T;
  analyticsAvailable: boolean;
  warning: string | null;
};

export async function withAnalyticsFallback<T>(
  label: string,
  factory: () => Promise<T>,
  fallback: T
): Promise<SafeAnalyticsResult<T>> {
  try {
    const data = await factory();
    return { data, analyticsAvailable: true, warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "development") {
      devLog("[dashboard-resilience] analytics section skipped", { label, message });
    }
    return {
      data: fallback,
      analyticsAvailable: false,
      warning: "Analytics temporarily unavailable",
    };
  }
}

export function factsHaveData(facts: CampaignAnalyticsFact[]): boolean {
  return facts.length > 0;
}
