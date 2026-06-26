"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormActionState } from "@/features/campaigns/form-action-state";
import { filterWritePayload } from "@/lib/campaigns/campaign-publications-schema";
import { countStorageTags } from "@/lib/performance/content-normalizer";
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
import { createSupabaseServerClient } from "@/lib/supabase/server";

const metricsSchema = z.object({
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

const updatePublicationSchema = z.object({
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

function revalidateCampaign(campaignId: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function updateCampaignPublicationAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const rawMetrics = formData.get("metrics_json");
  const parsed = updatePublicationSchema.safeParse({
    campaign_id: formData.get("campaign_id"),
    publication_id: formData.get("publication_id"),
    status: formData.get("status") || undefined,
    caption: formData.get("caption"),
    hashtags: formData.get("hashtags"),
    mentions: formData.get("mentions"),
    thumbnail_url: formData.get("thumbnail_url"),
    content_url: formData.get("content_url"),
    publication_date: formData.get("publication_date"),
    metrics: rawMetrics ? JSON.parse(String(rawMetrics)) : undefined,
    sync_status: formData.get("sync_status"),
    sync_source: formData.get("sync_source"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Invalid publication update." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.status) payload.status = parsed.data.status;
  if (parsed.data.caption !== undefined) {
    payload.caption = parsed.data.caption;
    payload.caption_source = "manual";
  }
  if (parsed.data.hashtags !== undefined) {
    payload.hashtags = parsed.data.hashtags;
    payload.hashtags_source = "manual";
    payload.hashtag_count = countStorageTags(parsed.data.hashtags);
  }
  if (parsed.data.mentions !== undefined) {
    payload.mentions = parsed.data.mentions;
    payload.mentions_source = "manual";
    payload.mention_count = countStorageTags(parsed.data.mentions);
  }
  if (parsed.data.thumbnail_url !== undefined) {
    payload.thumbnail_url = parsed.data.thumbnail_url || null;
  }
  if (parsed.data.content_url !== undefined) payload.content_url = parsed.data.content_url || null;
  if (parsed.data.publication_date !== undefined) {
    payload.publication_date = parsed.data.publication_date || null;
  }
  if (parsed.data.sync_status !== undefined) {
    payload.sync_status = parsed.data.sync_status;
    payload.api_sync_status = parsed.data.sync_status;
  }
  if (parsed.data.sync_source !== undefined) {
    payload.sync_source = parsed.data.sync_source;
    payload.detection_source = parsed.data.sync_source;
  }

  if (parsed.data.metrics) {
    const m = parsed.data.metrics;
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

  const { error } = await supabase
    .from("campaign_publications")
    .update(safePayload as never)
    .eq("id", parsed.data.publication_id)
    .eq("campaign_header_id", parsed.data.campaign_id);

  if (error) return { ok: false, message: error.message };

  invalidateCampaignPublicationsSchemaCache();
  revalidateCampaign(parsed.data.campaign_id);
  return { ok: true, message: "Publication updated." };
}

export async function bulkUpdatePublicationStatusAction(input: {
  campaignId: string;
  publicationIds: string[];
  status: string;
}): Promise<{ ok: boolean; message: string }> {
  if (input.publicationIds.length === 0) {
    return { ok: false, message: "No publications selected." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

  const { error } = await supabase
    .from("campaign_publications")
    .update({ status: input.status, updated_at: new Date().toISOString() } as never)
    .eq("campaign_header_id", input.campaignId)
    .in("id", input.publicationIds);

  if (error) return { ok: false, message: error.message };

  revalidateCampaign(input.campaignId);
  return { ok: true, message: `Updated ${input.publicationIds.length} publication(s).` };
}

export async function bulkImportPublicationsAction(input: {
  campaignId: string;
  rows: Array<Record<string, string>>;
}): Promise<{ ok: boolean; message: string; imported: number }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized", imported: 0 };

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

  const { error } = await supabase.from("campaign_publications").insert(inserts as never);
  if (error) return { ok: false, message: error.message, imported: 0 };

  revalidateCampaign(input.campaignId);
  return { ok: true, message: `Imported ${inserts.length} publication(s).`, imported: inserts.length };
}

export async function deleteCampaignPublicationAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

  const { error } = await supabase
    .from("campaign_publications")
    .delete()
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignId);

  if (error) return { ok: false, message: error.message };

  invalidateCampaignPublicationsSchemaCache();
  revalidateCampaign(input.campaignId);
  return { ok: true, message: "Publication removed." };
}

export async function refreshPublicationMetricsAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string; status?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

  try {
    const result = await requestMetricsCollection(supabase, {
      publicationId: input.publicationId,
      campaignHeaderId: input.campaignId,
      triggeredBy: "manual_refresh",
    });
    revalidateCampaign(input.campaignId);
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

export async function refreshCampaignMetricsAction(input: {
  campaignId: string;
  publicationIds?: string[];
}): Promise<{ ok: boolean; message: string; processed: number }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized", processed: 0 };

  try {
    const result = await requestCampaignMetricsCollection(supabase, {
      campaignHeaderId: input.campaignId,
      publicationIds: input.publicationIds,
      triggeredBy: "bulk_refresh",
    });
    revalidateCampaign(input.campaignId);
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

export async function importPublicationMetricsAction(input: {
  campaignId: string;
  rows: Array<Record<string, string>>;
}): Promise<{ ok: boolean; message: string; updated: number }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized", updated: 0 };

  let updated = 0;

  for (const row of input.rows) {
    const publicationId = row.publication_id?.trim() || row.id?.trim();
    const contentUrl = row.content_url?.trim();
    const metrics = parseMetricsImportRow(row);
    if (!hasImportMetrics(metrics)) continue;

    let targetId: string | undefined = publicationId || undefined;
    if (!targetId && contentUrl) {
      const { data: match } = await supabase
        .from("campaign_publications")
        .select("id")
        .eq("campaign_header_id", input.campaignId)
        .eq("content_url", contentUrl)
        .maybeSingle();
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

  revalidateCampaign(input.campaignId);
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

export async function importPublicationMetricsFileAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState & { updated?: number }> {
  const campaignId = String(formData.get("campaign_id") ?? "");
  const file = formData.get("file");
  if (!campaignId || !(file instanceof File)) {
    return { ok: false, message: "Missing campaign or file." };
  }

  let rows: Array<Record<string, string>> = [];
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
    if (!sheet) return { ok: false, message: "Excel file has no sheets." };
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  } else {
    rows = parseCsvText(await file.text());
  }

  const result = await importPublicationMetricsAction({ campaignId, rows });
  return { ok: result.ok, message: result.message, updated: result.updated };
}

export async function requestPublicationMetricsSyncAction(input: {
  campaignId: string;
  publicationIds: string[];
}): Promise<{ ok: boolean; message: string }> {
  if (input.publicationIds.length === 0) {
    return { ok: false, message: "No publications selected." };
  }

  const result = await refreshCampaignMetricsAction({
    campaignId: input.campaignId,
    publicationIds: input.publicationIds,
  });

  return { ok: result.ok, message: result.message };
}

export async function requestPublicationScreenshotAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<FormActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

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

  revalidateCampaign(input.campaignId);
  return { ok: true, message: "Screenshot capture queued." };
}

export type PublicationMetricSyncLogRow = {
  id: string;
  created_at: string;
  provider: string | null;
  status: string;
  metrics_refresh_status: string | null;
  message: string | null;
  duration_ms: number | null;
  metrics_snapshot: Record<string, number | null> | null;
  triggered_by: string | null;
  previous_er: number | null;
  new_er: number | null;
  previous_method: string | null;
  new_method: string | null;
  response_summary: Record<string, unknown> | null;
};

export async function loadPublicationSyncLogsAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; logs: PublicationMetricSyncLogRow[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, logs: [], error: "Unauthorized" };

  const { data, error } = await supabase
    .from("publication_metric_sync_logs")
    .select(
      "id, created_at, provider, status, metrics_refresh_status, message, duration_ms, metrics_snapshot, triggered_by, previous_er, new_er, previous_method, new_method, response_summary"
    )
    .eq("campaign_header_id", input.campaignId)
    .eq("publication_id", input.publicationId)
    .order("created_at", { ascending: false })
    .limit(50);

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

export async function savePublicationDetailsAction(input: {
  campaignId: string;
  publicationId: string;
  details: z.infer<typeof publicationDetailsSchema>;
}): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

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

  const { error } = await supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignId);

  if (error) return { ok: false, message: error.message };

  revalidateCampaign(input.campaignId);
  return { ok: true, message: "Publication details saved." };
}

export async function saveManualPublicationMetricsAction(input: {
  campaignId: string;
  publicationId: string;
  metrics: z.infer<typeof manualMetricsSchema>;
}): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

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

  revalidateCampaign(input.campaignId);
  return { ok: true, message: "Manual metrics saved." };
}

export async function restoreAutomaticPublicationMetricsAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string; status?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

  const result = await requestMetricsCollection(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignId,
    triggeredBy: "manual_restore_automatic",
  });

  revalidateCampaign(input.campaignId);

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
