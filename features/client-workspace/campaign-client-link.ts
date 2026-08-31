import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import { CLIENT_REVIEW_LINK_MISSING_MESSAGE } from "./constants";
import { createClientReviewFromCampaign } from "./create-from-campaign";
import { createClientReviewFromQuotation } from "./create-from-quotation";
import { createClientReviewFromShortlist } from "./create-from-shortlist";
import {
  revealClientReviewShareLink,
  restoreStoppedClientReviewShareLink,
  stopClientReviewShareLink,
  type ReviewScope,
} from "./persist-client-review";

export type EnsureCampaignClientReviewLinkResult =
  | { ok: true; url: string; reviewNumber: number; created: boolean; message: string }
  | { ok: false; message: string; blockers: string[] };

export type RevealCampaignClientReviewShareResult =
  | { ok: true; url: string; reviewNumber: number }
  | { ok: false; message: string };

export type StopCampaignClientReviewShareResult =
  | { ok: true; stopped: boolean; message: string }
  | { ok: false; message: string };

export type ClientWorkspaceListLinkScope =
  | { source: "campaign"; campaignHeaderId: string }
  | { source: "quotation"; quotationId: string }
  | { source: "shortlist"; shortlistId: string };

export function resolveClientReviewOrigin(headerOrigin: string | null | undefined): string {
  return (
    headerOrigin?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dev.thinkwaymedia.com"
  );
}

function shareDb(userClient: SupabaseClient): SupabaseClient {
  return tryCreateServiceRoleClient().client ?? userClient;
}

function asReviewScope(scope: ClientWorkspaceListLinkScope): ReviewScope {
  return scope;
}

async function mintMissingClientReviewLink(
  db: SupabaseClient,
  input: { userId: string; origin: string; scope: ClientWorkspaceListLinkScope }
): Promise<EnsureCampaignClientReviewLinkResult> {
  if (input.scope.source === "shortlist") {
    const created = await createClientReviewFromShortlist(db, {
      shortlistId: input.scope.shortlistId,
      userId: input.userId,
      origin: input.origin,
      mintMissingShareToken: true,
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

  if (input.scope.source === "quotation") {
    const created = await createClientReviewFromQuotation(db, {
      quotationId: input.scope.quotationId,
      userId: input.userId,
      origin: input.origin,
      mintMissingShareToken: true,
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

  const { data: header } = await db
    .from("campaign_headers")
    .select("id, quotation_id")
    .eq("id", input.scope.campaignHeaderId)
    .maybeSingle();
  const quotationId = (header as { quotation_id?: string | null } | null)?.quotation_id?.trim();
  if (quotationId) {
    const fromQuotation = await createClientReviewFromQuotation(db, {
      quotationId,
      userId: input.userId,
      origin: input.origin,
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
    campaignHeaderId: input.scope.campaignHeaderId,
    userId: input.userId,
    origin: input.origin,
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

export async function ensureClientReviewLink(input: {
  supabase: SupabaseClient;
  userId: string;
  origin: string;
  scope: ClientWorkspaceListLinkScope;
}): Promise<EnsureCampaignClientReviewLinkResult> {
  const db = shareDb(input.supabase);
  const origin = resolveClientReviewOrigin(input.origin);

  const restored = await restoreStoppedClientReviewShareLink({
    supabase: db,
    userId: input.userId,
    scope: asReviewScope(input.scope),
  });
  if (!restored.ok) {
    return { ok: false, message: restored.message, blockers: [restored.message] };
  }

  const existing = await revealClientReviewShareLink({
    supabase: db,
    origin,
    scope: asReviewScope(input.scope),
  });
  if (existing.ok) {
    return {
      ok: true,
      url: existing.url,
      reviewNumber: existing.reviewNumber,
      created: existing.created,
      message: restored.restored
        ? "Client Workspace link is on again. The share address is unchanged."
        : "Client Workspace link is ready.",
    };
  }
  if (existing.message !== CLIENT_REVIEW_LINK_MISSING_MESSAGE) {
    return { ok: false, message: existing.message, blockers: [existing.message] };
  }

  return mintMissingClientReviewLink(db, {
    userId: input.userId,
    origin,
    scope: input.scope,
  });
}

export async function ensureCampaignClientReviewLink(input: {
  supabase: SupabaseClient;
  campaignHeaderId: string;
  userId: string;
  origin: string;
}): Promise<EnsureCampaignClientReviewLinkResult> {
  return ensureClientReviewLink({
    supabase: input.supabase,
    userId: input.userId,
    origin: input.origin,
    scope: { source: "campaign", campaignHeaderId: input.campaignHeaderId },
  });
}

export async function revealClientReviewShare(input: {
  supabase: SupabaseClient;
  origin: string;
  scope: ClientWorkspaceListLinkScope;
}): Promise<RevealCampaignClientReviewShareResult> {
  const existing = await revealClientReviewShareLink({
    supabase: shareDb(input.supabase),
    origin: resolveClientReviewOrigin(input.origin),
    scope: asReviewScope(input.scope),
  });
  if (!existing.ok) {
    return { ok: false, message: existing.message };
  }
  return { ok: true, url: existing.url, reviewNumber: existing.reviewNumber };
}

export async function revealCampaignClientReviewShare(input: {
  supabase: SupabaseClient;
  campaignHeaderId: string;
  origin: string;
}): Promise<RevealCampaignClientReviewShareResult> {
  return revealClientReviewShare({
    supabase: input.supabase,
    origin: input.origin,
    scope: { source: "campaign", campaignHeaderId: input.campaignHeaderId },
  });
}

export async function stopClientReviewShare(input: {
  supabase: SupabaseClient;
  userId: string;
  scope: ClientWorkspaceListLinkScope;
}): Promise<StopCampaignClientReviewShareResult> {
  const result = await stopClientReviewShareLink({
    supabase: shareDb(input.supabase),
    userId: input.userId,
    scope: asReviewScope(input.scope),
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

export async function stopCampaignClientReviewShare(input: {
  supabase: SupabaseClient;
  campaignHeaderId: string;
  userId: string;
}): Promise<StopCampaignClientReviewShareResult> {
  return stopClientReviewShare({
    supabase: input.supabase,
    userId: input.userId,
    scope: { source: "campaign", campaignHeaderId: input.campaignHeaderId },
  });
}
