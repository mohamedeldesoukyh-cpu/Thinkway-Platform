import { NextResponse } from "next/server";

import {
  createCampaignPublicationsBatch,
  formatPublicationZodIssues,
  publicationBatchSchema,
} from "@/lib/campaigns/create-campaign-publications";
import { requireApiAnyPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export const dynamic = "force-dynamic";

/**
 * Create publications via HTTP so the Campaign Workspace does not remount
 * through a Server Action + route `loading.tsx` (Thinkway logo flash).
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
  const auth = await requireApiAnyPermission(supabase, [
    "campaigns.write",
    "publications.write",
  ]);
  if ("response" in auth) return auth.response;

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

  const result = await createCampaignPublicationsBatch(
    supabase,
    parsed.data.campaign_id,
    parsed.data.items
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
