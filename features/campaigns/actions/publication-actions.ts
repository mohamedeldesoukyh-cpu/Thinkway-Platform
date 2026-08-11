"use server";

import { z } from "zod";

import type { FormActionState } from "@/features/campaigns/form-action-state";
import {
  createCampaignPublicationsBatch,
  formatPublicationZodIssues,
  publicationBatchSchema,
  publicationItemSchema,
} from "@/lib/campaigns/create-campaign-publications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const publicationSchema = publicationItemSchema.extend({
  campaign_id: z.string().uuid(),
});

export async function createCampaignPublicationAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = publicationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: formatPublicationZodIssues(parsed.error),
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
  const result = await createCampaignPublicationsBatch(supabase, campaign_id, [item]);
  return { ok: result.ok, message: result.message };
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

  const parsed = publicationBatchSchema.safeParse({
    campaign_id: formData.get("campaign_id"),
    items: itemsRaw,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: formatPublicationZodIssues(parsed.error),
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

  const result = await createCampaignPublicationsBatch(
    supabase,
    parsed.data.campaign_id,
    parsed.data.items
  );
  return { ok: result.ok, message: result.message };
}
