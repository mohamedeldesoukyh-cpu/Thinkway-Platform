"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormActionState } from "@/features/campaigns/actions";
import { deriveCalculatedMetrics } from "@/lib/campaigns/performance-calculations";
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
  if (parsed.data.caption !== undefined) payload.caption = parsed.data.caption;
  if (parsed.data.hashtags !== undefined) payload.hashtags = parsed.data.hashtags;
  if (parsed.data.mentions !== undefined) payload.mentions = parsed.data.mentions;
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

  const { error } = await supabase
    .from("campaign_publications")
    .update(payload as never)
    .eq("id", parsed.data.publication_id)
    .eq("campaign_header_id", parsed.data.campaign_id);

  if (error) return { ok: false, message: error.message };

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

  const inserts = input.rows
    .filter((row) => row.platform && row.publication_type)
    .map((row) => ({
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
    }));

  if (inserts.length === 0) {
    return { ok: false, message: "No valid rows to import.", imported: 0 };
  }

  const { error } = await supabase.from("campaign_publications").insert(inserts as never);
  if (error) return { ok: false, message: error.message, imported: 0 };

  revalidateCampaign(input.campaignId);
  return { ok: true, message: `Imported ${inserts.length} publication(s).`, imported: inserts.length };
}

export async function requestPublicationMetricsSyncAction(input: {
  campaignId: string;
  publicationIds: string[];
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
    .update({
      sync_status: "queued",
      sync_source: "api",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("campaign_header_id", input.campaignId)
    .in("id", input.publicationIds);

  if (error) return { ok: false, message: error.message };

  revalidateCampaign(input.campaignId);
  return {
    ok: true,
    message: `Queued metrics sync for ${input.publicationIds.length} publication(s).`,
  };
}
