"use server";

import { headers } from "next/headers";

import { requirePermission } from "@/lib/auth/permissions-server";
import { SHORTLIST_PERMISSIONS } from "@/features/discovery/shortlists/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createClientReviewFromShortlist } from "../create-from-shortlist";

export async function createClientReviewFromShortlistAction(input: {
  shortlistId: string;
  selectedItemIds?: string[];
}): Promise<
  | { ok: true; url: string; reviewNumber: number; message: string }
  | { ok: false; message: string; blockers: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
  if ("error" in auth) {
    return { ok: false, message: auth.error, blockers: [auth.error] };
  }
  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dev.thinkwaymedia.com";

  const result = await createClientReviewFromShortlist(supabase, {
    shortlistId: input.shortlistId,
    selectedItemIds: input.selectedItemIds,
    userId: auth.userId,
    origin,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    url: result.url,
    reviewNumber: result.reviewNumber,
    message: `Client review v${result.reviewNumber} is ready. Share the secure link.`,
  };
}
