import { NextResponse } from "next/server";

import { getApprovedSnapshot } from "@/features/campaign-intelligence/services/campaign-export";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  buildCampaignProposalDocumentHtml,
  resolveCreatorIds,
  type ProposalVendor,
} from "@/features/campaign-studio/export/campaign-proposal-document";
import {
  buildCreatorContentIdea,
  creatorTierOf,
} from "@/features/campaign-studio/services/creator-slate";
import { mapBrowseCreatorToSearchResult } from "@/features/campaign-studio/services/creator-platform-utils";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Hydrate the recommended slate server-side so the proposal always carries avatars, followers, and tiers. */
async function hydrateProposalVendors(
  supabase: SupabaseServerClient,
  campaignObject: CampaignObject
): Promise<ProposalVendor[]> {
  try {
    const { ids } = resolveCreatorIds(campaignObject);
    const influencerIds = [
      ...new Set(
        ids
          .map((id) => id.trim())
          .filter((id) => Boolean(id) && !id.startsWith("dp:"))
          .map((id) => (id.startsWith("inf:") ? id.slice(4) : id))
      ),
    ];
    if (influencerIds.length === 0) return [];

    const result = await browseUnifiedCreators(
      supabase,
      { influencerIds, page: 1, pageSize: influencerIds.length, productionOnly: true },
      "discovery"
    );

    const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
    const reasoning: VendorSelectedReasoning[] =
      creatorsData.recommendations?.selectedReasoning ?? [];
    const reasonById = new Map(
      reasoning.map((r) => [r.creatorId.replace(/^inf:/, ""), r.whySelected])
    );
    const facts = getCampaignFacts(campaignObject);

    // Preserve the slate order persisted on the object.
    const order = new Map(influencerIds.map((id, index) => [id, index]));
    const cards = result.creators
      .map((creator) => mapBrowseCreatorToSearchResult(creator, facts?.platforms))
      .sort(
        (a, b) =>
          (order.get(a.id.replace(/^inf:/, "")) ?? 999) -
          (order.get(b.id.replace(/^inf:/, "")) ?? 999)
      );

    return cards.map((card, index) => ({
      displayName: card.displayName,
      handle: card.handle,
      platform: card.platform,
      followers: card.followers,
      engagementRate: card.engagementRate,
      avatarUrl: card.avatarUrl,
      tier: card.tier ?? creatorTierOf(card),
      reason: reasonById.get(card.id.replace(/^inf:/, "")),
      contentIdea: card.contentIdea ?? buildCreatorContentIdea(card, facts, index),
    }));
  } catch {
    // Export must degrade to section-reasoning rows, never fail on hydration.
    return [];
  }
}

/** Client logo from the client master, matched by extracted client name. */
async function resolveClientLogo(
  supabase: SupabaseServerClient,
  campaignObject: CampaignObject
): Promise<string | undefined> {
  try {
    const clientName = getCampaignFacts(campaignObject)?.clientName?.trim();
    if (!clientName) return undefined;
    const { data } = await supabase
      .from("clients")
      .select("logo_url")
      .ilike("name", `%${clientName}%`)
      .not("logo_url", "is", null)
      .limit(1)
      .maybeSingle();
    return (data as { logo_url: string | null } | null)?.logo_url ?? undefined;
  } catch {
    return undefined;
  }
}

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
      // Client-facing proposal document (CIO/VIO palette) — print to PDF from the browser.
      const campaignObject = snapshot as unknown as CampaignObject;
      const [vendors, clientLogoUrl] = await Promise.all([
        hydrateProposalVendors(supabase, campaignObject),
        resolveClientLogo(supabase, campaignObject),
      ]);
      const html = buildCampaignProposalDocumentHtml(campaignObject, vendors, {
        clientLogoUrl,
      });
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
