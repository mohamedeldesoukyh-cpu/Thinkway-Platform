import { NextResponse } from "next/server";

import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const versions = await CampaignObjectPersistenceService.listVersions(supabase, id);
    return NextResponse.json({ campaignObjectId: id, versions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list versions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
