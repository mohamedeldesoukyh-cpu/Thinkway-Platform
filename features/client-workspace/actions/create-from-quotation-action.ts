"use server";

import { headers } from "next/headers";

import { requirePermission } from "@/lib/auth/permissions-server";
import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createClientReviewFromQuotation } from "../create-from-quotation";

type CreateClientReviewActionResult =
  | { ok: true; url: string; reviewNumber: number; message: string }
  | { ok: false; message: string; blockers: string[] };

export async function createClientReviewFromQuotationAction(input: {
  quotationId: string;
}): Promise<CreateClientReviewActionResult> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) {
    const adminAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in adminAuth) {
      return { ok: false, message: auth.error, blockers: [auth.error] };
    }
    return run(input.quotationId, supabase, adminAuth.userId);
  }
  return run(input.quotationId, supabase, auth.userId);
}

async function run(
  quotationId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<CreateClientReviewActionResult> {
  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dev.thinkwaymedia.com";

  const result = await createClientReviewFromQuotation(supabase, {
    quotationId,
    userId,
    origin,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    url: result.url,
    reviewNumber: result.reviewNumber,
    message: `Client Workspace link is ready.`,
  };
}
