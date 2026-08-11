import { NextResponse } from "next/server";

import {
  createCampaignPublicationsBatch,
  formatPublicationZodIssues,
  publicationBatchSchema,
} from "@/lib/campaigns/create-campaign-publications";
import { getAuthContext } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export const dynamic = "force-dynamic";

/**
 * Create publications via HTTP so the Campaign Workspace does not remount
 * through a Server Action + route `loading.tsx` (Thinkway logo flash).
 * Auth matches the previous server action: signed-in user (RLS still applies).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await context.params;
  if (!isUuid(campaignId)) {
    return NextResponse.json({ ok: false, message: "Invalid campaign ID." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await getAuthContext(supabase);
  if (!auth.userId) {
    return NextResponse.json(
      { ok: false, message: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid publication list." }, { status: 400 });
  }

  const parsed = publicationBatchSchema.safeParse({
    campaign_id: campaignId,
    items: (body as { items?: unknown })?.items,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: formatPublicationZodIssues(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const result = await createCampaignPublicationsBatch(
      supabase,
      parsed.data.campaign_id,
      parsed.data.items
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[publications] batch create failed", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to add publications.",
      },
      { status: 500 }
    );
  }
}
