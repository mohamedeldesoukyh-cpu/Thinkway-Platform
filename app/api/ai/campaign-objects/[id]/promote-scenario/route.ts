import { NextResponse } from "next/server";

import { saveCampaignObject } from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import type { CampaignScenario } from "@/features/campaign-decision-engine";
import {
  assertCampaignObjectImmutable,
  snapshotCampaignObject,
} from "@/features/campaign-decision-engine";
import { applyScenarioToCampaignObject } from "@/features/campaign-decision-workspace/services/promote-scenario";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

type PromoteBody = {
  conversationId: string;
  scenario: CampaignScenario;
  reason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PromoteBody;
    if (!body.conversationId || !body.scenario) {
      return NextResponse.json(
        { error: "conversationId and scenario are required" },
        { status: 400 }
      );
    }

    const loaded = await CampaignObjectPersistenceService.loadLatestByConversation(
      supabase,
      body.conversationId
    );

    let campaignObject = loaded?.campaignObject ?? null;
    if (!campaignObject) {
      const { loadCampaignObjectForConversation } = await import(
        "@/features/campaign-intelligence/services/campaign-object-store"
      );
      campaignObject = await loadCampaignObjectForConversation(
        supabase,
        body.conversationId
      );
    }

    if (!campaignObject || campaignObject.id !== id) {
      return NextResponse.json({ error: "Campaign object not found" }, { status: 404 });
    }

    const snapshotBefore = snapshotCampaignObject(campaignObject);
    const promoted = applyScenarioToCampaignObject(campaignObject, body.scenario);

    if (!assertCampaignObjectImmutable(campaignObject, campaignObject)) {
      return NextResponse.json({ error: "Source object mutated unexpectedly" }, { status: 500 });
    }
    if (snapshotBefore !== snapshotCampaignObject(campaignObject)) {
      return NextResponse.json(
        { error: "CampaignObject was mutated before promotion" },
        { status: 500 }
      );
    }

    const versionResult = await CampaignObjectPersistenceService.saveVersion(supabase, {
      campaignObject: { ...promoted, conversationId: body.conversationId },
      conversationId: body.conversationId,
      userId: auth.userId,
      saveReason: "manual",
    });

    await saveCampaignObject(body.conversationId, promoted, {
      persistToDb: false,
    });

    return NextResponse.json({
      campaignObjectId: id,
      version: versionResult.version,
      versionId: versionResult.versionId,
      promotedScenarioName: body.scenario.name,
      campaignObject: { ...promoted, conversationId: body.conversationId },
      reason: body.reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Promotion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
