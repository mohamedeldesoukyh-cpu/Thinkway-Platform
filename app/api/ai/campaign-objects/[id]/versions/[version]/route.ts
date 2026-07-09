import { NextResponse } from "next/server";

import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string; version: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id, version } = await context.params;
  const versionNumber = Number.parseInt(version, 10);
  if (!Number.isFinite(versionNumber) || versionNumber <= 0) {
    return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const row = await CampaignObjectPersistenceService.loadVersion(
      supabase,
      id,
      versionNumber
    );
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ version: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
