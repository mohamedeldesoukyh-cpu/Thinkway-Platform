import type { SupabaseClient } from "@supabase/supabase-js";

import { metricsCollector, metricsCollectorById } from "@/lib/performance/metrics-collector/metrics-collector";
import {
  enqueuePublicationMetricsBulk,
  enqueuePublicationMetricsJob,
  isMetricsQueueAvailable,
} from "@/lib/performance/metrics-collector/queue";
import { isRefreshDue } from "@/lib/performance/metrics-collector/schedule-next-refresh";
import { queuePublicationForMetrics } from "@/lib/performance/metrics-collector/persist";
import type {
  CollectionOutcome,
  CollectionTrigger,
  MetricsCollectorOptions,
  PublicationForCollection,
} from "@/lib/performance/metrics-collector/types";

export { metricsCollector, metricsCollectorById };

export async function collectPublicationMetrics(
  supabase: SupabaseClient,
  publication: PublicationForCollection,
  triggeredBy: CollectionTrigger | string,
  options?: Pick<MetricsCollectorOptions, "playwrightExtract">
): Promise<CollectionOutcome> {
  return metricsCollector(supabase, publication, {
    triggeredBy,
    playwrightExtract: options?.playwrightExtract,
  });
}

export async function collectPublicationMetricsById(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    triggeredBy: CollectionTrigger | string;
    playwrightExtract?: MetricsCollectorOptions["playwrightExtract"];
  }
): Promise<CollectionOutcome> {
  return metricsCollectorById(supabase, input);
}

export async function requestMetricsCollection(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    triggeredBy: CollectionTrigger | string;
    playwrightExtract?: MetricsCollectorOptions["playwrightExtract"];
  }
): Promise<{ mode: "queued" | "inline"; outcome?: CollectionOutcome }> {
  await queuePublicationForMetrics(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignHeaderId,
  });

  if (isMetricsQueueAvailable()) {
    await enqueuePublicationMetricsJob({
      publicationId: input.publicationId,
      campaignHeaderId: input.campaignHeaderId,
      triggeredBy: input.triggeredBy,
    });
    return { mode: "queued" };
  }

  const outcome = await metricsCollectorById(supabase, input);
  return { mode: "inline", outcome };
}

export async function requestCampaignMetricsCollection(
  supabase: SupabaseClient,
  input: {
    campaignHeaderId: string;
    publicationIds?: string[];
    triggeredBy: CollectionTrigger | string;
  }
): Promise<{ queued: number; inline: number }> {
  let query = supabase
    .from("campaign_publications")
    .select("id, campaign_header_id")
    .eq("campaign_header_id", input.campaignHeaderId)
    .not("content_url", "is", null);

  if (input.publicationIds?.length) {
    query = query.in("id", input.publicationIds);
  }

  const { data, error } = await query.limit(100);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  let queued = 0;
  let inline = 0;

  if (isMetricsQueueAvailable()) {
    for (const row of rows) {
      await queuePublicationForMetrics(supabase, {
        publicationId: row.id,
        campaignHeaderId: row.campaign_header_id,
      });
    }
    const result = await enqueuePublicationMetricsBulk(
      rows.map((row) => ({
        publicationId: row.id,
        campaignHeaderId: row.campaign_header_id,
        triggeredBy: input.triggeredBy,
      }))
    );
    queued = result.enqueued;
  } else {
    for (const row of rows) {
      await metricsCollectorById(supabase, {
        publicationId: row.id,
        campaignHeaderId: row.campaign_header_id,
        triggeredBy: input.triggeredBy,
      });
      inline += 1;
    }
  }

  return { queued, inline };
}

export async function collectScheduledMetricsRefresh(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<{ processed: number; outcomes: CollectionOutcome[] }> {
  const limit = options?.limit ?? 50;

  const { data, error } = await supabase
    .from("campaign_publications")
    .select(
      "id, campaign_header_id, platform, content_url, external_media_id, publication_type, publication_date, status, created_at, metrics_refresh_status, metrics_refresh_attempted_at, metrics_next_refresh_at, last_synced_at"
    )
    .not("content_url", "is", null)
    .limit(limit * 4);

  if (error) throw new Error(error.message);

  const due = ((data ?? []) as PublicationForCollection[]).filter((row) =>
    isRefreshDue(
      (row as { metrics_next_refresh_at?: string | null }).metrics_next_refresh_at,
      (row as { metrics_refresh_status?: string | null }).metrics_refresh_status
    )
  ).slice(0, limit);

  if (isMetricsQueueAvailable()) {
    for (const row of due) {
      await queuePublicationForMetrics(supabase, {
        publicationId: row.id,
        campaignHeaderId: row.campaign_header_id,
      });
    }
    await enqueuePublicationMetricsBulk(
      due.map((row) => ({
        publicationId: row.id,
        campaignHeaderId: row.campaign_header_id,
        triggeredBy: "scheduled_worker",
      }))
    );
    return { processed: due.length, outcomes: [] };
  }

  const outcomes: CollectionOutcome[] = [];
  for (const row of due) {
    outcomes.push(
      await metricsCollector(supabase, row, { triggeredBy: "scheduled_worker" })
    );
  }
  return { processed: outcomes.length, outcomes };
}

/** @deprecated use requestCampaignMetricsCollection */
export async function collectCampaignMetricsBulk(
  supabase: SupabaseClient,
  input: {
    campaignHeaderId: string;
    publicationIds?: string[];
    triggeredBy: CollectionTrigger | string;
    limit?: number;
  }
): Promise<{ processed: number; outcomes: CollectionOutcome[] }> {
  const result = await requestCampaignMetricsCollection(supabase, input);
  return { processed: result.queued + result.inline, outcomes: [] };
}
