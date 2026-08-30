"use server";

import { headers } from "next/headers";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  ensureCampaignClientReviewLink,
  revealCampaignClientReviewShare,
  resolveClientReviewOrigin,
  stopCampaignClientReviewShare,
} from "../campaign-client-link";
import { peekClientReviewShareLink } from "../persist-client-review";

type Result =
  | { ok: true; url: string; reviewNumber: number; created: boolean; message: string }
  | { ok: false; message: string; blockers: string[] };

async function requireCampaignWrite(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const auth = await requirePermission(supabase, "campaigns.write");
  if (!("error" in auth)) return auth;
  const admin = await requirePermission(supabase, "campaigns.admin");
  if ("error" in admin) return { error: auth.error };
  return admin;
}

export async function ensureCampaignClientReviewLinkAction(input: {
  campaignHeaderId: string;
}): Promise<Result> {
  const supabase = await createSupabaseServerClient();
  const auth = await requireCampaignWrite(supabase);
  if ("error" in auth) {
    return { ok: false, message: auth.error, blockers: [auth.error] };
  }
  const origin = resolveClientReviewOrigin((await headers()).get("origin"));
  return ensureCampaignClientReviewLink({
    supabase,
    campaignHeaderId: input.campaignHeaderId,
    userId: auth.userId,
    origin,
  });
}

export async function peekCampaignClientReviewShareAction(input: {
  campaignHeaderId: string;
}): Promise<{ exists: boolean; reviewNumber?: number }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) {
    const write = await requirePermission(supabase, "campaigns.write");
    if ("error" in write) return { exists: false };
  }
  return peekClientReviewShareLink({
    supabase,
    scope: { source: "campaign", campaignHeaderId: input.campaignHeaderId },
  });
}

/** Reveal an existing Client Workspace URL. Never mints a new review from the campaign list. */
export async function revealCampaignClientReviewShareAction(input: {
  campaignHeaderId: string;
}): Promise<{ ok: true; url: string; reviewNumber: number } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) {
    const write = await requirePermission(supabase, "campaigns.write");
    if ("error" in write) return { ok: false, message: auth.error };
  }

  const origin = resolveClientReviewOrigin((await headers()).get("origin"));
  return revealCampaignClientReviewShare({
    supabase,
    campaignHeaderId: input.campaignHeaderId,
    origin,
  });
}

export async function stopCampaignClientReviewShareAction(input: {
  campaignHeaderId: string;
}): Promise<{ ok: true; stopped: boolean; message: string } | { ok: false; message: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const auth = await requireCampaignWrite(supabase);
    if ("error" in auth) return { ok: false, message: auth.error };
    return stopCampaignClientReviewShare({
      supabase,
      campaignHeaderId: input.campaignHeaderId,
      userId: auth.userId,
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not stop the Client Workspace link.",
    };
  }
}
