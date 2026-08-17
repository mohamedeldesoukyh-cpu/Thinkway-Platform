"use server";

import { headers } from "next/headers";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { requireStudioUser } from "@/features/campaign-studio/actions/persist-campaign-object-on-message";
import { getRequestAuth } from "@/lib/supabase/server";

import { createClientReview } from "../create-client-review";

export async function createClientReviewAction(input: {
  campaignObject: CampaignObject;
  conversationId: string;
}): Promise<
  | { ok: true; url: string; reviewNumber: number; frozenVersion: number; message: string }
  | { ok: false; message: string; blockers: string[] }
> {
  const { supabase, userId } = await requireStudioUser();
  const auth = await getRequestAuth();
  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dev.thinkwaymedia.com";

  const result = await createClientReview(supabase, {
    campaignObject: input.campaignObject,
    conversationId: input.conversationId,
    userId,
    roleSlug: auth.roleSlug,
    origin,
  });

  if (!result.ok) return result;
  return {
    ok: true,
    url: result.url,
    reviewNumber: result.reviewNumber,
    frozenVersion: result.frozenVersion,
    message: `Client review v${result.reviewNumber} is ready. Share the secure link.`,
  };
}
