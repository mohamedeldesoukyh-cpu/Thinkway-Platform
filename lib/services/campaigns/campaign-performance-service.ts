import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { filterWritePayload } from "@/lib/campaigns/campaign-publications-schema";
import { countStorageTags } from "@/lib/performance/content-normalizer";
import type { PublicationMetricSyncLogRow } from "@/lib/domains/campaign/types";
import {
  getCampaignPublicationsSchema,
  invalidateCampaignPublicationsSchemaCache,
} from "@/lib/campaigns/campaign-publications-schema-runtime";
import { deriveCalculatedMetrics } from "@/lib/campaigns/performance-calculations";
import {
  parseMetricsImportRow,
  requestCampaignMetricsCollection,
  requestMetricsCollection,
} from "@/lib/performance/metrics-collector";
import { persistCollectedMetrics } from "@/lib/performance/metrics-collector/persist";
import {
  bulkUpdateCampaignPublicationStatus,
  deleteCampaignPublicationRow,
  fetchPublicationMetricSyncLogs,
  findCampaignPublicationIdByContentUrl,
  insertCampaignPublications,
  updateCampaignPublicationRow,
} from "./repositories/performance-repository";
import { countCampaignPublications } from "./repositories/publication-repository";

export async function getCampaignPublicationCount(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<number> {
  return countCampaignPublications(supabase, campaignHeaderId);
}

export const metricsSchema = z.object({
  impressions: z.coerce.number().optional().nullable(),
  reach: z.coerce.number().optional().nullable(),
  views: z.coerce.number().optional().nullable(),
  unique_views: z.coerce.number().optional().nullable(),
  likes: z.coerce.number().optional().nullable(),
  comments: z.coerce.number().optional().nullable(),
  shares: z.coerce.number().optional().nullable(),
  saves: z.coerce.number().optional().nullable(),
  clicks: z.coerce.number().optional().nullable(),
  plays: z.coerce.number().optional().nullable(),
  watch_time_seconds: z.coerce.number().optional().nullable(),
  average_watch_time_seconds: z.coerce.number().optional().nullable(),
  completion_rate: z.coerce.number().optional().nullable(),
  cost: z.coerce.number().optional().nullable(),
  currency: z.string().max(3).optional().nullable(),
  sentiment_score: z.coerce.number().optional().nullable(),
  brand_safety_score: z.coerce.number().optional().nullable(),
  authenticity_score: z.coerce.number().optional().nullable(),
});

export const updatePublicationSchema = z.object({
  campaign_id: z.string().uuid(),
  publication_id: z.string().uuid(),
  status: z.string().optional(),
  caption: z.string().max(4000).optional().nullable(),
  hashtags: z.string().max(1000).optional().nullable(),
  mentions: z.string().max(1000).optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable().or(z.literal("")),
  content_url: z.string().url().optional().nullable().or(z.literal("")),
  publication_date: z.string().optional().nullable(),
  metrics: metricsSchema.optional(),
  sync_status: z.string().optional().nullable(),
  sync_source: z.string().optional().nullable(),
});


export async function updateCampaignPublication(
  supabase: SupabaseClient,
  parsed: z.infer<typeof updatePublicationSchema>
): Promise<{ ok: boolean; message: string }> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.status) payload.status = parsed.status;
  if (parsed.caption !== undefined) {
    payload.caption = parsed.caption;
    payload.caption_source = "manual";
  }
  if (parsed.hashtags !== undefined) {
    payload.hashtags = parsed.hashtags;
    payload.hashtags_source = "manual";
    payload.hashtag_count = countStorageTags(parsed.hashtags);
  }
  if (parsed.mentions !== undefined) {
    payload.mentions = parsed.mentions;
    payload.mentions_source = "manual";
    payload.mention_count = countStorageTags(parsed.mentions);
  }
  if (parsed.thumbnail_url !== undefined) {
    payload.thumbnail_url = parsed.thumbnail_url || null;
  }
  if (parsed.content_url !== undefined) payload.content_url = parsed.content_url || null;
  if (parsed.publication_date !== undefined) {
    payload.publication_date = parsed.publication_date || null;
  }
  if (parsed.sync_status !== undefined) {
    payload.sync_status = parsed.sync_status;
    payload.api_sync_status = parsed.sync_status;
  }
  if (parsed.sync_source !== undefined) {
    payload.sync_source = parsed.sync_source;
    payload.detection_source = parsed.sync_source;
  }

  if (parsed.metrics) {
    const m = parsed.metrics;
    Object.assign(payload, {
      impressions: m.impressions ?? null,
      reach: m.reach ?? null,
      views: m.views ?? null,
      unique_views: m.unique_views ?? null,
      likes: m.likes ?? null,
      comments: m.comments ?? null,
      shares: m.shares ?? null,
      saves: m.saves ?? null,
      clicks: m.clicks ?? null,
      plays: m.plays ?? null,
      watch_time_seconds: m.watch_time_seconds ?? null,
      average_watch_time_seconds: m.average_watch_time_seconds ?? null,
      completion_rate: m.completion_rate ?? null,
      cost: m.cost ?? null,
      currency: m.currency ?? "USD",
      sentiment_score: m.sentiment_score ?? null,
      brand_safety_score: m.brand_safety_score ?? null,
      authenticity_score: m.authenticity_score ?? null,
      engagement_views: m.views ?? null,
      engagement_likes: m.likes ?? null,
      engagement_comments: m.comments ?? null,
      engagement_shares: m.shares ?? null,
    });

    const derived = deriveCalculatedMetrics({
      impressions: m.impressions ?? null,
      reach: m.reach ?? null,
      views: m.views ?? null,
      likes: m.likes ?? null,
      comments: m.comments ?? null,
      shares: m.shares ?? null,
      saves: m.saves ?? null,
      clicks: m.clicks ?? null,
      cost: m.cost ?? null,
    });
    Object.assign(payload, derived);
  }

  const schema = await getCampaignPublicationsSchema(supabase);
  const safePayload = filterWritePayload(payload, schema.columns);

  const { error } = await updateCampaignPublicationRow(supabase, parsed.campaign_id, parsed.publication_id, safePayload);

  if (error) return { ok: false, message: error.message };

  invalidateCampaignPublicationsSchemaCache();
  return { ok: true, message: "Publication updated." };
}

export async function bulkUpdatePublicationStatus(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationIds: string[];
  status: string;
}): Promise<{ ok: boolean; message: string }> {
  if (input.publicationIds.length === 0) {
    return { ok: false, message: "No publications selected." };
  }

const { error } = await bulkUpdateCampaignPublicationStatus(supabase, input.campaignId, input.publicationIds, input.status);

  if (error) return { ok: false, message: error.message };

  return { ok: true, message: `Updated ${input.publicationIds.length} publication(s).` };
}

export async function bulkImportPublications(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  rows: Array<Record<string, string>>;
}): Promise<{ ok: boolean; message: string; imported: number }> {
const schema = await getCampaignPublicationsSchema(supabase);
  const inserts = input.rows
    .filter((row) => row.platform && row.publication_type)
    .map((row) =>
      filterWritePayload(
        {
          campaign_header_id: input.campaignId,
          platform: row.platform,
          publication_type: row.publication_type,
          content_url: row.content_url || null,
          publication_date: row.publication_date || null,
          status: row.status || "published",
          caption: row.caption || null,
          hashtags: row.hashtags || null,
          views: row.views ? Number(row.views) : null,
          reach: row.reach ? Number(row.reach) : null,
          impressions: row.impressions ? Number(row.impressions) : null,
          likes: row.likes ? Number(row.likes) : null,
          comments: row.comments ? Number(row.comments) : null,
          shares: row.shares ? Number(row.shares) : null,
          cost: row.cost ? Number(row.cost) : null,
          detected_by: "csv_import",
          auto_detected: false,
        },
        schema.columns
      )
    );

  if (inserts.length === 0) {
    return { ok: false, message: "No valid rows to import.", imported: 0 };
  }

  const { error } = await insertCampaignPublications(supabase, inserts);
  if (error) return { ok: false, message: error.message, imported: 0 };

  return { ok: true, message: `Imported ${inserts.length} publication(s).`, imported: inserts.length };
}

export async function deleteCampaignPublication(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await deleteCampaignPublicationRow(
    supabase,
    input.campaignId,
    input.publicationId
  );

  if (error) return { ok: false, message: error.message };
  if (!data?.length) {
    return {
      ok: false,
      message: "Publication was not deleted. It may already be gone or access was denied.",
    };
  }

  invalidateCampaignPublicationsSchemaCache();
  return { ok: true, message: "Publication removed." };
}

export async function refreshPublicationMetrics(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string; status?: string }> {
try {
    const result = await requestMetricsCollection(supabase, {
      publicationId: input.publicationId,
      campaignHeaderId: input.campaignId,
      triggeredBy: "manual_refresh",
    });
    if (result.mode === "queued") {
      return { ok: true, message: "Metrics collection queued.", status: "queued" };
    }
    const outcome = result.outcome!;
    return {
      ok: ["completed", "partial"].includes(outcome.status),
      message: outcome.message,
      status: outcome.status,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Metrics refresh failed.",
    };
  }
}

export async function refreshCampaignMetrics(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationIds?: string[];
}): Promise<{ ok: boolean; message: string; processed: number }> {
try {
    const result = await requestCampaignMetricsCollection(supabase, {
      campaignHeaderId: input.campaignId,
      publicationIds: input.publicationIds,
      triggeredBy: "bulk_refresh",
    });
    const processed = result.queued + result.inline;
    return {
      ok: true,
      processed,
      message:
        result.queued > 0
          ? `Queued ${result.queued} publication(s) for metrics collection.`
          : `Processed ${result.inline} publication(s) inline (Redis unavailable).`,
    };
  } catch (error) {
    return {
      ok: false,
      processed: 0,
      message: error instanceof Error ? error.message : "Bulk refresh failed.",
    };
  }
}

export async function importPublicationMetrics(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  rows: Array<Record<string, string>>;
}): Promise<{ ok: boolean; message: string; updated: number }> {
let updated = 0;

  for (const row of input.rows) {
    const publicationId = row.publication_id?.trim() || row.id?.trim();
    const contentUrl = row.content_url?.trim();
    const metrics = parseMetricsImportRow(row);
    if (!hasImportMetrics(metrics)) continue;

    let targetId: string | undefined = publicationId || undefined;
    if (!targetId && contentUrl) {
      const { data: match } = await findCampaignPublicationIdByContentUrl(supabase, input.campaignId, contentUrl);
      targetId = match?.id ?? undefined;
    }

    if (!targetId) continue;

    await persistCollectedMetrics(supabase, {
      publicationId: targetId,
      campaignHeaderId: input.campaignId,
      metrics,
      status: "partial",
      source: "manual_import",
      confidence: 100,
      triggeredBy: "manual_import",
    });
    updated += 1;
  }

  if (updated === 0) {
    return {
      ok: false,
      message: "No rows matched a publication (use publication_id or content_url).",
      updated: 0,
    };
  }

  return {
    ok: true,
    message: `Updated metrics for ${updated} publication(s) via manual import.`,
    updated,
  };
}

function hasImportMetrics(metrics: ReturnType<typeof parseMetricsImportRow>): boolean {
  return Object.values(metrics).some((v) => v != null);
}

function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]*)/g) ?? [];
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (cells[i] ?? "").replace(/^"|"$/g, "").replace(/""/g, '"').trim();
    });
    return record;
  });
}

export async function importPublicationMetricsFile(
  supabase: SupabaseClient,
  input: { campaignId: string; rows: Array<Record<string, string>> }
): Promise<{ ok: boolean; message: string; updated?: number }> {
  const result = await importPublicationMetrics(supabase, { campaignId: input.campaignId, rows: input.rows });
  return { ok: result.ok, message: result.message, updated: result.updated };
}

export async function requestPublicationMetricsSync(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationIds: string[];
}): Promise<{ ok: boolean; message: string }> {
  if (input.publicationIds.length === 0) {
    return { ok: false, message: "No publications selected." };
  }

  const result = await refreshCampaignMetrics(supabase, {
    campaignId: input.campaignId,
    publicationIds: input.publicationIds,
  });

  return { ok: result.ok, message: result.message };
}

export async function requestPublicationScreenshot(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string }> {
  const { enqueuePublicationScreenshotJob } = await import(
    "@/lib/performance/screenshot-capture/queue"
  );

  const { enqueued } = await enqueuePublicationScreenshotJob({
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignId,
    triggeredBy: "manual_refresh",
  });

  if (!enqueued) {
    return {
      ok: false,
      message: "Screenshot queue unavailable — start discovery-worker with REDIS_URL.",
    };
  }

  return { ok: true, message: "Screenshot capture queued." };
}

export type { PublicationMetricSyncLogRow } from "@/lib/domains/campaign/types";

export async function loadPublicationSyncLogs(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; logs: PublicationMetricSyncLogRow[]; error?: string }> {
const { data, error } = await fetchPublicationMetricSyncLogs(supabase, input.campaignId, input.publicationId);

  if (error) return { ok: false, logs: [], error: error.message };

  const rows = (data ?? []) as PublicationMetricSyncLogRow[];
  return {
    ok: true,
    logs: rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      provider: row.provider,
      status: row.status,
      metrics_refresh_status: row.metrics_refresh_status,
      message: row.message,
      duration_ms: row.duration_ms,
      metrics_snapshot: (row.metrics_snapshot as Record<string, number | null>) ?? null,
      triggered_by: row.triggered_by,
      previous_er: row.previous_er ?? null,
      new_er: row.new_er ?? null,
      previous_method: row.previous_method ?? null,
      new_method: row.new_method ?? null,
      response_summary: (row.response_summary as Record<string, unknown>) ?? null,
    })),
  };
}

const manualMetricsSchema = z.object({
  views: z.coerce.number().min(0).optional().nullable(),
  reach: z.coerce.number().min(0).optional().nullable(),
  impressions: z.coerce.number().min(0).optional().nullable(),
  likes: z.coerce.number().min(0).optional().nullable(),
  comments: z.coerce.number().min(0).optional().nullable(),
  shares: z.coerce.number().min(0).optional().nullable(),
  saves: z.coerce.number().min(0).optional().nullable(),
});

const publicationDetailsSchema = z.object({
  publication_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
    .optional()
    .nullable(),
  content_url: z.string().url().optional().nullable().or(z.literal("")),
  caption: z.string().max(4000).optional().nullable(),
  hashtags: z.string().max(1000).optional().nullable(),
});

export async function savePublicationDetails(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationId: string;
  details: z.infer<typeof publicationDetailsSchema>;
}): Promise<{ ok: boolean; message: string }> {
const parsed = publicationDetailsSchema.safeParse(input.details);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const schema = await getCampaignPublicationsSchema(supabase);
  const payload = filterWritePayload(
    {
      ...(parsed.data.publication_date !== undefined
        ? { publication_date: parsed.data.publication_date || null }
        : {}),
      ...(parsed.data.content_url !== undefined
        ? { content_url: parsed.data.content_url || null }
        : {}),
      ...(parsed.data.caption !== undefined
        ? { caption: parsed.data.caption, caption_source: "manual" }
        : {}),
      ...(parsed.data.hashtags !== undefined
        ? {
            hashtags: parsed.data.hashtags,
            hashtags_source: "manual",
            hashtag_count: countStorageTags(parsed.data.hashtags),
          }
        : {}),
      updated_at: new Date().toISOString(),
    },
    schema.columns
  );

  if (Object.keys(payload).length <= 1) {
    return { ok: false, message: "No changes to save." };
  }

  const { error } = await updateCampaignPublicationRow(supabase, input.campaignId, input.publicationId, payload);

  if (error) return { ok: false, message: error.message };

  return { ok: true, message: "Publication details saved." };
}

export async function saveManualPublicationMetrics(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationId: string;
  metrics: z.infer<typeof manualMetricsSchema>;
}): Promise<{ ok: boolean; message: string }> {
const parsed = manualMetricsSchema.safeParse(input.metrics);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid metrics." };
  }

  const metrics = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value != null)
  ) as Record<string, number>;

  if (Object.keys(metrics).length === 0) {
    return { ok: false, message: "Enter at least one metric value." };
  }

  await persistCollectedMetrics(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignId,
    metrics,
    status: "partial",
    source: "manual",
    confidence: 100,
    triggeredBy: "manual",
  });

  return { ok: true, message: "Manual metrics saved." };
}

export async function restoreAutomaticPublicationMetrics(
  supabase: SupabaseClient,
  input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string; status?: string }> {
const result = await requestMetricsCollection(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignId,
    triggeredBy: "manual_restore_automatic",
  });

  if (result.mode === "queued") {
    return { ok: true, message: "Automatic metrics refresh queued.", status: "queued" };
  }

  const outcome = result.outcome!;
  return {
    ok: ["completed", "partial"].includes(outcome.status),
    message: outcome.message,
    status: outcome.status,
  };
}
