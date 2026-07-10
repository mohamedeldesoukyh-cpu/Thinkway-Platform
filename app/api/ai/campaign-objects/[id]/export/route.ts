import { NextResponse } from "next/server";

import { getApprovedSnapshot } from "@/features/campaign-intelligence/services/campaign-export";
import { buildCampaignProposalDocumentHtml } from "@/features/campaign-studio/export/campaign-proposal-document";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId") ?? undefined;
  const format = url.searchParams.get("format");

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const snapshot = await getApprovedSnapshot(supabase, {
      campaignObjectId: id,
      conversationId,
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "No approved campaign snapshot available" },
        { status: 404 }
      );
    }

    await logAuditEvent(supabase, {
      userId: auth.userId,
      action: "export",
      entityType: "campaign_object",
      entityId: id,
      metadata: {
        audit_action: "campaign_object_export",
        conversation_id: conversationId,
        source: snapshot.workflowId,
      },
    });

    if (format === "html") {
      // Client-facing proposal document (VIO/CIO palette) — print to PDF from the browser.
      const html = buildCampaignProposalDocumentHtml(snapshot as unknown as CampaignObject);
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json({
      campaignObjectId: id,
      snapshot,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
