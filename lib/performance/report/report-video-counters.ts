import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import { sanitizeMetricValue } from "@/lib/performance/metrics-collector/merge-metrics";

/** Only attach source counters when their successful snapshot matches the current metrics. */
export async function attachReportVideoCounters(supabase: SupabaseClient, rows: CampaignPublicationRow[]) {
  return Promise.all(rows.map(async row => {
    const { data, error } = await supabase.from("publication_metric_sync_logs")
      .select("response_summary,metrics_snapshot")
      .eq("campaign_header_id", row.campaign_header_id).eq("publication_id", row.id)
      .eq("provider", row.metrics_provider === "manual" ? "manual" : "apify").eq("response_summary->>metrics_found", "true")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const counters = data?.response_summary?.videoCounters;
    if (error || !counters || data?.metrics_snapshot?.views !== row.views) return row;
    return { ...row, report_video_counters: {
      plays: sanitizeMetricValue(counters.plays), views: sanitizeMetricValue(counters.views),
    } };
  }));
}
