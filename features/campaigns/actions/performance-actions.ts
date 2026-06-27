"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormActionState } from "@/features/campaigns/form-action-state";
import type { PublicationMetricSyncLogRow } from "@/lib/domains/campaign/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  bulkImportPublications,
  bulkUpdatePublicationStatus,
  deleteCampaignPublication,
  importPublicationMetrics,
  importPublicationMetricsFile as importPublicationMetricsFileService,
  loadPublicationSyncLogs,
  refreshCampaignMetrics,
  refreshPublicationMetrics,
  requestPublicationMetricsSync as requestPublicationMetricsSyncService,
  requestPublicationScreenshot,
  restoreAutomaticPublicationMetrics,
  saveManualPublicationMetrics,
  savePublicationDetails,
  updateCampaignPublication,
  updatePublicationSchema,
} from "@/lib/services/campaigns/campaign-performance-service";

function revalidateCampaign(campaignId: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return supabase;
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

  try {
    const supabase = await requireAuth();
    const result = await updateCampaignPublication(supabase, parsed.data);
    if (result.ok) revalidateCampaign(parsed.data.campaign_id);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized" };
  }
}

export async function bulkUpdatePublicationStatusAction(input: {
  campaignId: string;
  publicationIds: string[];
  status: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const supabase = await requireAuth();
    const result = await bulkUpdatePublicationStatus(supabase, input);
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized" };
  }
}

export async function bulkImportPublicationsAction(input: {
  campaignId: string;
  rows: Array<Record<string, string>>;
}): Promise<{ ok: boolean; message: string; imported: number }> {
  try {
    const supabase = await requireAuth();
    const result = await bulkImportPublications(supabase, input);
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized", imported: 0 };
  }
}

export async function deleteCampaignPublicationAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const supabase = await requireAuth();
    const result = await deleteCampaignPublication(supabase, input);
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized" };
  }
}

export async function refreshPublicationMetricsAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string; status?: string }> {
  try {
    const supabase = await requireAuth();
    const result = await refreshPublicationMetrics(supabase, input);
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
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
  try {
    const supabase = await requireAuth();
    const result = await refreshCampaignMetrics(supabase, input);
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
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
  try {
    const supabase = await requireAuth();
    const result = await importPublicationMetrics(supabase, input);
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized", updated: 0 };
  }
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
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length >= 2) {
      const headers = lines[0]!.split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
      rows = lines.slice(1).map((line) => {
        const cells = line.match(/("([^"]|"")*"|[^,]*)/g) ?? [];
        const record: Record<string, string> = {};
        headers.forEach((h, i) => {
          record[h] = (cells[i] ?? "").replace(/^"|"$/g, "").replace(/""/g, '"').trim();
        });
        return record;
      });
    }
  }

  try {
    const supabase = await requireAuth();
    const result = await importPublicationMetricsFileService(supabase, { campaignId, rows });
    if (result.ok) revalidateCampaign(campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized" };
  }
}

export async function requestPublicationMetricsSyncAction(input: {
  campaignId: string;
  publicationIds: string[];
}): Promise<{ ok: boolean; message: string }> {
  try {
    const supabase = await requireAuth();
    const result = await requestPublicationMetricsSyncService(supabase, input);
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized" };
  }
}

export async function requestPublicationScreenshotAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<FormActionState> {
  try {
    const supabase = await requireAuth();
    const result = await requestPublicationScreenshot(supabase, input);
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized" };
  }
}

export async function loadPublicationSyncLogsAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; logs: PublicationMetricSyncLogRow[]; error?: string }> {
  try {
    const supabase = await requireAuth();
    return loadPublicationSyncLogs(supabase, input);
  } catch {
    return { ok: false, logs: [], error: "Unauthorized" };
  }
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
  const parsed = publicationDetailsSchema.safeParse(input.details);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  try {
    const supabase = await requireAuth();
    const result = await savePublicationDetails(supabase, {
      campaignId: input.campaignId,
      publicationId: input.publicationId,
      details: parsed.data,
    });
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized" };
  }
}

export async function saveManualPublicationMetricsAction(input: {
  campaignId: string;
  publicationId: string;
  metrics: z.infer<typeof manualMetricsSchema>;
}): Promise<{ ok: boolean; message: string }> {
  const parsed = manualMetricsSchema.safeParse(input.metrics);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid metrics." };
  }

  try {
    const supabase = await requireAuth();
    const result = await saveManualPublicationMetrics(supabase, {
      campaignId: input.campaignId,
      publicationId: input.publicationId,
      metrics: parsed.data,
    });
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized" };
  }
}

export async function restoreAutomaticPublicationMetricsAction(input: {
  campaignId: string;
  publicationId: string;
}): Promise<{ ok: boolean; message: string; status?: string }> {
  try {
    const supabase = await requireAuth();
    const result = await restoreAutomaticPublicationMetrics(supabase, input);
    if (result.ok) revalidateCampaign(input.campaignId);
    return result;
  } catch {
    return { ok: false, message: "Unauthorized" };
  }
}
