"use server";

import { headers } from "next/headers";

import { requireStudioUser } from "@/features/campaign-studio/actions/persist-campaign-object-on-message";
import { SHORTLIST_PERMISSIONS } from "@/features/discovery/shortlists/constants";
import { requirePermission } from "@/lib/auth/permissions-server";
import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  peekClientReviewShareLink,
  revealClientReviewShareLink,
  type ReviewScope,
} from "../persist-client-review";

type RevealResult =
  | { ok: true; url: string; reviewId: string; reviewNumber: number }
  | { ok: false; message: string };

export async function revealClientReviewLinkAction(
  input:
    | { source: "quotation"; quotationId: string }
    | { source: "shortlist"; shortlistId: string }
    | { source: "studio"; campaignObjectId: string }
    | { source: "campaign"; campaignHeaderId: string }
): Promise<RevealResult> {
  const supabase = await createSupabaseServerClient();
  if (input.source === "quotation") {
    const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
    if ("error" in auth) {
      const adminAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
      if ("error" in adminAuth) return { ok: false, message: auth.error };
    }
  } else if (input.source === "shortlist") {
    const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
    if ("error" in auth) return { ok: false, message: auth.error };
  } else if (input.source === "campaign") {
    const auth = await requirePermission(supabase, "campaigns.read");
    if ("error" in auth) {
      const write = await requirePermission(supabase, "campaigns.write");
      if ("error" in write) return { ok: false, message: auth.error };
    }
  } else {
    await requireStudioUser();
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dev.thinkwaymedia.com";

  const scope: ReviewScope =
    input.source === "quotation"
      ? { source: "quotation", quotationId: input.quotationId }
      : input.source === "shortlist"
        ? { source: "shortlist", shortlistId: input.shortlistId }
        : input.source === "campaign"
          ? { source: "campaign", campaignHeaderId: input.campaignHeaderId }
          : { source: "studio", campaignObjectId: input.campaignObjectId };

  return revealClientReviewShareLink({ supabase, origin, scope });
}

export async function peekClientReviewShareAction(
  input:
    | { source: "quotation"; quotationId: string }
    | { source: "shortlist"; shortlistId: string }
    | { source: "campaign"; campaignHeaderId: string }
): Promise<{ exists: boolean; reviewNumber?: number }> {
  const supabase = await createSupabaseServerClient();
  if (input.source === "campaign") {
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
  if (input.source === "shortlist") {
    const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
    if ("error" in auth) return { exists: false };
    return peekClientReviewShareLink({
      supabase,
      scope: { source: "shortlist", shortlistId: input.shortlistId },
    });
  }
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) {
    const adminAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in adminAuth) return { exists: false };
  }
  return peekClientReviewShareLink({
    supabase,
    scope: { source: "quotation", quotationId: input.quotationId },
  });
}
