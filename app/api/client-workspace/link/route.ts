import { NextResponse } from "next/server";

import { requireApiAnyPermission } from "@/lib/auth/api-auth";
import {
  ensureClientReviewLink,
  revealClientReviewShare,
  resolveClientReviewOrigin,
  stopClientReviewShare,
  type ClientWorkspaceListLinkScope,
} from "@/features/client-workspace/campaign-client-link";
import { SHORTLIST_PERMISSIONS } from "@/features/discovery/shortlists/constants";
import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export const dynamic = "force-dynamic";

/**
 * Shortlist / quotation / campaign list Client link controls share one HTTP
 * endpoint so Stop / Activate do not re-render list pages through a Server Action.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const source = (body as { source?: unknown })?.source;
  const id = typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : "";
  const op = (body as { op?: unknown })?.op;
  if (source !== "campaign" && source !== "quotation" && source !== "shortlist") {
    return NextResponse.json({ ok: false, message: "Invalid Client link source." }, { status: 400 });
  }
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, message: "Invalid record ID." }, { status: 400 });
  }
  if (op !== "activate" && op !== "stop" && op !== "reveal") {
    return NextResponse.json({ ok: false, message: "Invalid Client link operation." }, { status: 400 });
  }

  const scope: ClientWorkspaceListLinkScope =
    source === "campaign"
      ? { source, campaignHeaderId: id }
      : source === "quotation"
        ? { source, quotationId: id }
        : { source, shortlistId: id };

  const supabase = await createSupabaseServerClient();
  const origin = resolveClientReviewOrigin(request.headers.get("origin"));
  const readPermissions =
    source === "campaign"
      ? ["campaigns.read", "campaigns.write"]
      : source === "quotation"
        ? [QUOTATION_PERMISSIONS.read, QUOTATION_PERMISSIONS.write]
        : [SHORTLIST_PERMISSIONS.read, SHORTLIST_PERMISSIONS.write];
  const writePermissions =
    source === "campaign"
      ? ["campaigns.write", "campaigns.admin"]
      : source === "quotation"
        ? [QUOTATION_PERMISSIONS.write, QUOTATION_PERMISSIONS.admin]
        : [SHORTLIST_PERMISSIONS.write, SHORTLIST_PERMISSIONS.admin];

  try {
    if (op === "reveal") {
      const auth = await requireApiAnyPermission(supabase, readPermissions);
      if ("response" in auth) return auth.response;
      const result = await revealClientReviewShare({ supabase, origin, scope });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const auth = await requireApiAnyPermission(supabase, writePermissions);
    if ("response" in auth) return auth.response;

    if (op === "stop") {
      const result = await stopClientReviewShare({
        supabase,
        userId: auth.userId,
        scope,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const result = await ensureClientReviewLink({
      supabase,
      userId: auth.userId,
      origin,
      scope,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[client-link] list mutation failed", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Could not update the Client Workspace link.",
      },
      { status: 500 }
    );
  }
}
