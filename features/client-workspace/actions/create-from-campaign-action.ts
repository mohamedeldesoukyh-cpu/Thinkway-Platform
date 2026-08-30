"use server";

import { headers } from "next/headers";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import { createClientReviewFromCampaign } from "../create-from-campaign";
import { createClientReviewFromQuotation } from "../create-from-quotation";
import { CLIENT_REVIEW_LINK_MISSING_MESSAGE } from "../constants";
import {
  peekClientReviewShareLink,
  revealClientReviewShareLink,
  stopCampaignClientReviewShareLink,
} from "../persist-client-review";

type Result =
  | { ok: true; url: string; reviewNumber: number; created: boolean; message: string }
  | { ok: false; message: string; blockers: string[] };

export async function ensureCampaignClientReviewLinkAction(input: {
  campaignHeaderId: string;
}): Promise<Result> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) {
    const admin = await requirePermission(supabase, "campaigns.admin");
    if ("error" in admin) {
      return { ok: false, message: auth.error, blockers: [auth.error] };
    }
    return run(input.campaignHeaderId, admin.userId);
  }
  return run(input.campaignHeaderId, auth.userId);
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

  const userClient = await createSupabaseServerClient();
  const db = tryCreateServiceRoleClient().client ?? userClient;
  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dev.thinkwaymedia.com";

  const existing = await revealClientReviewShareLink({
    supabase: db,
    origin,
    scope: { source: "campaign", campaignHeaderId: input.campaignHeaderId },
  });
  if (!existing.ok) {
    return { ok: false, message: existing.message };
  }
  return { ok: true, url: existing.url, reviewNumber: existing.reviewNumber };
}

export async function stopCampaignClientReviewShareAction(input: {
  campaignHeaderId: string;
}): Promise<{ ok: true; stopped: boolean; message: string } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.write");
  let userId: string;
  if ("error" in auth) {
    const admin = await requirePermission(supabase, "campaigns.admin");
    if ("error" in admin) return { ok: false, message: auth.error };
    userId = admin.userId;
  } else {
    userId = auth.userId;
  }

  const userClient = await createSupabaseServerClient();
  const db = tryCreateServiceRoleClient().client ?? userClient;
  const result = await stopCampaignClientReviewShareLink({
    supabase: db,
    campaignHeaderId: input.campaignHeaderId,
    userId,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    stopped: result.stopped,
    message: result.stopped
      ? "Client Workspace link stopped."
      : "Client Workspace link is already off.",
  };
}

async function run(campaignHeaderId: string, userId: string): Promise<Result> {
  const userClient = await createSupabaseServerClient();
  const db = tryCreateServiceRoleClient().client ?? userClient;
  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dev.thinkwaymedia.com";
  const scope = { source: "campaign" as const, campaignHeaderId };

  const existing = await revealClientReviewShareLink({ supabase: db, origin, scope });
  if (existing.ok) {
    return {
      ok: true,
      url: existing.url,
      reviewNumber: existing.reviewNumber,
      created: existing.created,
      message: "Client Workspace link is ready.",
    };
  }
  if (existing.message !== CLIENT_REVIEW_LINK_MISSING_MESSAGE) {
    return { ok: false, message: existing.message, blockers: [existing.message] };
  }

  const { data: header } = await db
    .from("campaign_headers")
    .select("id, quotation_id")
    .eq("id", campaignHeaderId)
    .maybeSingle();
  const quotationId = (header as { quotation_id?: string | null } | null)?.quotation_id?.trim();
  if (quotationId) {
    const fromQuotation = await createClientReviewFromQuotation(db, {
      quotationId,
      userId,
      origin,
      mintMissingShareToken: true,
    });
    if (fromQuotation.ok) {
      return {
        ok: true,
        url: fromQuotation.url,
        reviewNumber: fromQuotation.reviewNumber,
        created: true,
        message: `Client Workspace v${fromQuotation.reviewNumber} is ready. Share the secure link.`,
      };
    }
  }

  const created = await createClientReviewFromCampaign(db, {
    campaignHeaderId,
    userId,
    origin,
  });
  if (!created.ok) return created;
  return {
    ok: true,
    url: created.url,
    reviewNumber: created.reviewNumber,
    created: true,
    message: `Client Workspace v${created.reviewNumber} is ready. Share the secure link.`,
  };
}
