import { NextResponse } from "next/server";

import { requireApiAnyPermission } from "@/lib/auth/api-auth";
import {
  ensureCampaignClientReviewLink,
  revealCampaignClientReviewShare,
  resolveClientReviewOrigin,
  stopCampaignClientReviewShare,
} from "@/features/client-workspace/campaign-client-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export const dynamic = "force-dynamic";

/**
 * Campaign list Client link controls use HTTP so Stop / Activate do not
 * re-render /campaigns through a Server Action (Next masks that failure as a
 * Server Components digest toast and leaves the row Active).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: campaignHeaderId } = await context.params;
  if (!isUuid(campaignHeaderId)) {
    return NextResponse.json({ ok: false, message: "Invalid campaign ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const op = (body as { op?: unknown })?.op;
  if (op !== "activate" && op !== "stop" && op !== "reveal") {
    return NextResponse.json({ ok: false, message: "Invalid Client link operation." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const origin = resolveClientReviewOrigin(request.headers.get("origin"));

  try {
    if (op === "reveal") {
      const auth = await requireApiAnyPermission(supabase, ["campaigns.read", "campaigns.write"]);
      if ("response" in auth) return auth.response;
      const result = await revealCampaignClientReviewShare({
        supabase,
        campaignHeaderId,
        origin,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const auth = await requireApiAnyPermission(supabase, [
      "campaigns.write",
      "campaigns.admin",
    ]);
    if ("response" in auth) return auth.response;

    if (op === "stop") {
      const result = await stopCampaignClientReviewShare({
        supabase,
        campaignHeaderId,
        userId: auth.userId,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const result = await ensureCampaignClientReviewLink({
      supabase,
      campaignHeaderId,
      userId: auth.userId,
      origin,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[client-link] campaign list mutation failed", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Could not update the Client Workspace link.",
      },
      { status: 500 }
    );
  }
}
