import { emptyCampaignPerformanceSummary } from "@/features/campaigns/queries/campaign-performance-defaults";
import type {
  CampaignPerformanceCharts,
  CampaignPerformanceSummary,
  CampaignPublicationRow,
} from "@/lib/domains/campaign/types";
import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import { traceCampaignRouteError } from "@/lib/performance/campaign-route-trace";
import { getCampaignPerformanceBundle } from "@/lib/services/campaigns/campaign-publication-service";
import { isUuid } from "@/lib/validation/uuid";

export type CampaignPublicationsBundleData = {
  publications: CampaignPublicationRow[];
  summary: CampaignPerformanceSummary;
  charts: CampaignPerformanceCharts;
  syncHealth: CampaignMetricsSyncHealth;
  schemaWarnings: string[];
  loadError: string | null;
};

export type CampaignPublicationsBundleResult =
  | { ok: true; data: CampaignPublicationsBundleData }
  | { ok: false; error: string };

function emptyPerformanceCharts(): CampaignPerformanceCharts {
  return {
    performance_over_time: [],
    platform_split: [],
    content_type_split: [],
    top_creators_by_engagement: [],
    reach_by_creator: [],
    views_by_publication: [],
    engagement_distribution: [],
  };
}

export function emptyCampaignPublicationsBundleData(
  loadError: string | null = null
): CampaignPublicationsBundleData {
  return {
    publications: [],
    summary: emptyCampaignPerformanceSummary(),
    charts: emptyPerformanceCharts(),
    schemaWarnings: [],
    syncHealth: {
      synced: 0,
      partial: 0,
      failed: 0,
      manual_required: 0,
      queued: 0,
      collecting: 0,
      total: 0,
    },
    loadError,
  };
}

export async function resolveCampaignPublicationsBundle(
  campaignId: string
): Promise<CampaignPublicationsBundleResult> {
  if (!isUuid(campaignId)) {
    return { ok: false, error: "Invalid campaign ID." };
  }

  try {
    const result = await getCampaignPerformanceBundle(campaignId);
    return {
      ok: true,
      data: {
        publications: result.publications,
        summary: result.summary,
        charts: result.charts,
        syncHealth: result.sync_health,
        schemaWarnings: result.schema_warnings,
        loadError: result.load_error,
      },
    };
  } catch (error) {
    traceCampaignRouteError("publications-bundle:failed", error, { campaignId });
    const message =
      error instanceof Error ? error.message : "Failed to load publications.";
    console.error("[publications-bundle] load failed", { campaignId, message });
    if (process.env.NODE_ENV === "development") {
      return { ok: false, error: message };
    }
    return {
      ok: true,
      data: emptyCampaignPublicationsBundleData(message),
    };
  }
}
