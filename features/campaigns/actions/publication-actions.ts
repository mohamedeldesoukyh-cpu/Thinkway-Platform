"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormActionState } from "@/features/campaigns/form-action-state";
import {
  canonicalPlatformKey,
  coerceDeliverableTypeForPlatform,
} from "@/lib/campaigns/deliverable-taxonomy";
import { requestMetricsCollection } from "@/lib/performance/metrics-collector";
import { validateInstagramPublicationUrl } from "@/lib/performance/metrics-collector/instagram-content-url";
import { syncLiveDateFromPublication } from "@/lib/campaigns/sync-live-date-from-publication";
import { detectSocialPlatformFromContentUrl } from "@/lib/social/platforms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type Supabase = SupabaseClient<Database>;

/** Zod v4-safe optional UUID (accepts "", null, undefined). */
const optionalUuid = z
  .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.length > 0 ? value : ""));

const publicationItemSchema = z.object({
  campaign_line_id: optionalUuid,
  influencer_id: optionalUuid,
  platform: z.string().trim().min(1).max(64),
  publication_type: z.string().trim().min(1).max(64),
  content_url: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null;
      const trimmed = String(v).trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .pipe(z.union([z.string().url(), z.null()])),
  publication_date: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v : "")),
  status: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      const trimmed = typeof v === "string" ? v.trim() : "";
      return trimmed.length > 0 ? trimmed : "draft";
    }),
  assignee_id: optionalUuid,
  caption: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v : "")),
  hashtags: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v : "")),
  notes: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v : "")),
});

const publicationSchema = publicationItemSchema.extend({
  campaign_id: z.string().uuid(),
});

const batchSchema = z.object({
  campaign_id: z.string().uuid(),
  items: z.array(publicationItemSchema).min(1).max(40),
});

function revalidateCampaign(campaignId: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

function formatZodIssues(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid publication input.";
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

type PublicationItem = z.infer<typeof publicationItemSchema>;

async function insertOnePublication(
  supabase: Supabase,
  campaignId: string,
  item: PublicationItem
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const urlPlatform = detectSocialPlatformFromContentUrl(item.content_url);
  let platform = canonicalPlatformKey(item.platform) || item.platform;
  let publicationType = item.publication_type;

  // URL host always wins — prevents IG taxonomy validation on TikTok/Facebook links.
  if (urlPlatform) {
    platform = urlPlatform;
  }

  publicationType = coerceDeliverableTypeForPlatform(
    platform,
    publicationType,
    item.content_url
  );

  if (item.content_url && platform === "instagram") {
    const urlError = validateInstagramPublicationUrl(publicationType, item.content_url);
    if (urlError) {
      return { ok: false, message: urlError };
    }
  }

  if (!item.campaign_line_id) {
    return { ok: false, message: "Select a creator for each URL." };
  }

  if (!item.content_url) {
    return { ok: false, message: "Each publication needs a content URL." };
  }

  const { data: inserted, error } = await supabase
    .from("campaign_publications")
    .insert({
      campaign_header_id: campaignId,
      campaign_line_id: item.campaign_line_id || null,
      influencer_id: item.influencer_id || null,
      platform,
      publication_type: publicationType,
      content_url: item.content_url,
      publication_date: item.publication_date || null,
      status: item.status,
      assignee_id: item.assignee_id || null,
      caption: item.caption || null,
      hashtags: item.hashtags || null,
      notes: item.notes || null,
      auto_detected: false,
      detected_by: "manual",
      metrics_refresh_status: "pending",
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    console.error("[publications] create failed", { message: error?.message });
    return { ok: false, message: error?.message ?? "Failed to create publication." };
  }

  if (item.publication_date) {
    try {
      await syncLiveDateFromPublication(supabase, {
        campaignHeaderId: campaignId,
        campaignLineId: item.campaign_line_id || null,
        platform,
        publicationDate: item.publication_date,
        publicationId: inserted.id,
      });
    } catch (syncError) {
      console.warn("[publications] live date sync failed", syncError);
    }
  }

  if (item.content_url) {
    try {
      await requestMetricsCollection(supabase, {
        publicationId: inserted.id,
        campaignHeaderId: campaignId,
        triggeredBy: "auto_create",
      });
    } catch (collectError) {
      console.warn("[publications] auto metrics collection failed", collectError);
    }
  }

  return { ok: true, id: inserted.id };
}

export async function createCampaignPublicationAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = publicationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: formatZodIssues(parsed.error),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: authError?.message ?? "Unauthorized" };
  }

  const { campaign_id, ...item } = parsed.data;
  const result = await insertOnePublication(supabase, campaign_id, item);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateCampaign(campaign_id);
  return { ok: true, message: "Publication added." };
}

export async function createCampaignPublicationsBatchAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  let itemsRaw: unknown;
  try {
    itemsRaw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, message: "Invalid publication list." };
  }

  const parsed = batchSchema.safeParse({
    campaign_id: formData.get("campaign_id"),
    items: itemsRaw,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: formatZodIssues(parsed.error),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: authError?.message ?? "Unauthorized" };
  }

  const { campaign_id, items } = parsed.data;
  let created = 0;
  const failures: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const label = item.content_url?.trim() || `Row ${i + 1}`;
    const result = await insertOnePublication(supabase, campaign_id, item);
    if (result.ok) {
      created += 1;
    } else {
      failures.push(`${label}: ${result.message}`);
    }
  }

  if (created > 0) {
    revalidateCampaign(campaign_id);
  }

  if (failures.length === 0) {
    return {
      ok: true,
      message: created === 1 ? "Publication added." : `${created} publications added.`,
    };
  }

  if (created === 0) {
    return {
      ok: false,
      message: failures[0] ?? "Failed to add publications.",
    };
  }

  return {
    ok: true,
    message: `Added ${created} of ${items.length}. ${failures[0]}`,
  };
}
