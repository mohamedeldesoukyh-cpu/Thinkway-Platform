"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/permissions-server";
import {
  listCampaignStoryPosts,
  markStoriesLive,
  persistStoryScreenshotOnPublication,
} from "@/lib/campaigns/mark-stories-live";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const listSchema = z.object({
  campaignId: z.string().uuid(),
  campaignLineId: z.string().uuid(),
});

const markSchema = z.object({
  campaignId: z.string().uuid(),
  items: z
    .array(
      z.object({
        assignmentPostScheduleId: z.string().uuid(),
        wentLiveDate: z.string().trim().min(8).max(32),
        contentUrl: z.string().trim().max(2000).optional().nullable(),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
    )
    .min(1)
    .max(80),
});

const screenshotSchema = z.object({
  campaignId: z.string().uuid(),
  publicationId: z.string().uuid(),
  bucket: z.string().trim().min(1).max(128),
  storagePath: z.string().trim().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(128),
});

export type MarkStoriesLiveActionResult =
  | {
      ok: true;
      message: string;
      marked: number;
      results: Array<{
        assignmentPostScheduleId: string;
        publicationId: string;
        assignmentDeliverableId: string;
        alreadyLive: boolean;
        createdPublication: boolean;
      }>;
    }
  | { ok: false; message: string };

async function getWriteClient() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) {
    const admin = await requirePermission(supabase, "campaigns.admin");
    if ("error" in admin) return { ok: false as const, message: auth.error };
    return { ok: true as const, supabase };
  }
  return { ok: true as const, supabase };
}

async function getReadClient() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) return getWriteClient();
  return { ok: true as const, supabase };
}

export async function listCampaignStoryPostsAction(input: {
  campaignId: string;
  campaignLineId: string;
}) {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid creator." };
  const actor = await getReadClient();
  if (!actor.ok) return actor;
  return listCampaignStoryPosts(actor.supabase, parsed.data);
}

export async function markStoriesLiveAction(input: {
  campaignId: string;
  items: Array<{
    assignmentPostScheduleId: string;
    wentLiveDate: string;
    contentUrl?: string | null;
    notes?: string | null;
  }>;
}): Promise<MarkStoriesLiveActionResult> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid story selection." };
  }
  const actor = await getWriteClient();
  if (!actor.ok) return actor;
  const result = await markStoriesLive(actor.supabase, parsed.data);
  if (result.ok) {
    revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  }
  return result;
}

export async function persistStoryScreenshotAction(input: {
  campaignId: string;
  publicationId: string;
  bucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = screenshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid screenshot upload." };
  const actor = await getWriteClient();
  if (!actor.ok) return actor;
  const result = await persistStoryScreenshotOnPublication(actor.supabase, parsed.data);
  if (result.ok) {
    revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  }
  return result;
}
