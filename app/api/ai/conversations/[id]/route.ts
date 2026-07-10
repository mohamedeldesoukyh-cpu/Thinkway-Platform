import { NextResponse } from "next/server";

import {
  deleteConversation,
  getConversationWithMessages,
  setConversationArchived,
  setConversationPinned,
  updateConversationTitle,
} from "@/features/ai-workspace/services/conversation-service";
import { hydrateConversationCampaignObject } from "@/features/ai-workspace/services/conversation-campaign-hydration";
import { hasPermission } from "@/lib/auth/permissions";
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
    const conversation = await getConversationWithMessages(
      supabase,
      id,
      auth.userId
    );
    if (!conversation) {
      // A conversation the user just streamed into must never be invisible here.
      // Log which RLS predicate fails so environment drift is diagnosable from
      // a single reload instead of a silent 404 (see 20260715090000 migration).
      const [sqlHasAiRead, sqlHasAiWrite] = await Promise.all([
        hasPermission(supabase, "ai.read"),
        hasPermission(supabase, "ai.write"),
      ]);
      console.error(
        "[ai-conversations] GET 404 diagnosis:",
        JSON.stringify({
          conversationId: id,
          userId: auth.userId,
          roleSlug: auth.roleSlug,
          sqlHasAiRead,
          sqlHasAiWrite,
        })
      );
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const hydrated = await hydrateConversationCampaignObject(supabase, conversation);
    return NextResponse.json({ conversation: hydrated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      isPinned?: boolean;
      archived?: boolean;
    };

    if (body.title !== undefined) {
      await updateConversationTitle(supabase, id, auth.userId, body.title);
    }
    if (body.isPinned !== undefined) {
      await setConversationPinned(supabase, id, auth.userId, body.isPinned);
    }
    if (body.archived !== undefined) {
      await setConversationArchived(supabase, id, auth.userId, body.archived);
    }

    const conversation = await getConversationWithMessages(
      supabase,
      id,
      auth.userId
    );
    return NextResponse.json({ conversation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    await deleteConversation(supabase, id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
