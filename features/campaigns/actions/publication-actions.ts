"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormActionState } from "@/features/campaigns/form-action-state";
import { canonicalPlatformKey, getDeliverableTypeCodesForPlatform } from "@/lib/campaigns/deliverable-taxonomy";
import { requestMetricsCollection } from "@/lib/performance/metrics-collector";
import { validateInstagramPublicationUrl } from "@/lib/performance/metrics-collector/instagram-content-url";
import { detectSocialPlatformFromContentUrl } from "@/lib/social/platforms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const publicationSchema = z.object({
  campaign_id: z.string().uuid(),
  campaign_line_id: z.string().uuid().optional().or(z.literal("")),
  influencer_id: z.string().uuid().optional().or(z.literal("")),
  platform: z.string().trim().min(1).max(64),
  publication_type: z.string().trim().min(1).max(64),
  content_url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .pipe(z.string().url().nullable()),
  publication_date: z.string().optional().or(z.literal("")),
  status: z.string().trim().min(1).max(64).default("draft"),
  assignee_id: z.string().uuid().optional().or(z.literal("")),
  caption: z.string().max(4000).optional().or(z.literal("")),
  hashtags: z.string().max(1000).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

function revalidateCampaign(campaignId: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function createCampaignPublicationAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = publicationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid publication input.",
      fieldErrors: parsed.error.flatten().fieldErrors,
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

  const urlPlatform = detectSocialPlatformFromContentUrl(parsed.data.content_url);
  let platform = canonicalPlatformKey(parsed.data.platform) || parsed.data.platform;
  let publicationType = parsed.data.publication_type;

  // Prefer URL-detected platform so a TikTok link is never validated as Instagram.
  if (urlPlatform && urlPlatform !== platform) {
    platform = urlPlatform;
    const types = getDeliverableTypeCodesForPlatform(platform);
    if (!types.includes(publicationType)) {
      publicationType = types[0] ?? "other";
    }
  }

  if (parsed.data.content_url && platform === "instagram") {
    const urlError = validateInstagramPublicationUrl(
      publicationType,
      parsed.data.content_url
    );
    if (urlError) {
      return {
        ok: false,
        message: urlError,
        fieldErrors: { content_url: [urlError] },
      };
    }
  }

  const { data: inserted, error } = await supabase
    .from("campaign_publications")
    .insert({
      campaign_header_id: parsed.data.campaign_id,
      campaign_line_id: parsed.data.campaign_line_id || null,
      influencer_id: parsed.data.influencer_id || null,
      platform,
      publication_type: publicationType,
      content_url: parsed.data.content_url,
      publication_date: parsed.data.publication_date || null,
      status: parsed.data.status,
      assignee_id: parsed.data.assignee_id || null,
      caption: parsed.data.caption || null,
      hashtags: parsed.data.hashtags || null,
      notes: parsed.data.notes || null,
      auto_detected: false,
      detected_by: "manual",
      metrics_refresh_status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[publications] create failed", { message: error.message });
    return { ok: false, message: error.message };
  }

  if (inserted?.id && parsed.data.content_url) {
    try {
      await requestMetricsCollection(supabase, {
        publicationId: inserted.id,
        campaignHeaderId: parsed.data.campaign_id,
        triggeredBy: "auto_create",
      });
    } catch (collectError) {
      console.warn("[publications] auto metrics collection failed", collectError);
    }
  }

  revalidateCampaign(parsed.data.campaign_id);
  return { ok: true, message: "Publication added." };
}
