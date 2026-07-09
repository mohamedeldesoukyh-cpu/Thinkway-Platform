import { NextResponse } from "next/server";

import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import type { CampaignObjectLifecycleStatus } from "@/features/campaign-intelligence/types/campaign-lifecycle";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { lifecycleStatus?: CampaignObjectLifecycleStatus };
    if (!body.lifecycleStatus) {
      return NextResponse.json({ error: "lifecycleStatus is required" }, { status: 400 });
    }

    const record = await CampaignObjectPersistenceService.transitionLifecycle(supabase, {
      campaignObjectId: id,
      toStatus: body.lifecycleStatus,
      userId: auth.userId,
      roleSlug: auth.roleSlug,
    });

    return NextResponse.json({ campaignObject: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lifecycle update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
