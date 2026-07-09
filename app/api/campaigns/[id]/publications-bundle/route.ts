import { NextResponse } from "next/server";

import { resolveCampaignPublicationsBundle } from "@/lib/campaigns/publications-bundle-loader";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, error: "Invalid campaign ID." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "campaigns.read");
  if ("response" in auth) return auth.response;

  const result = await resolveCampaignPublicationsBundle(id);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
