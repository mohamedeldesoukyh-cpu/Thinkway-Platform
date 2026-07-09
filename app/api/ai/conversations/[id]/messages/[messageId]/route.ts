import { NextResponse } from "next/server";

import {
  deleteMessage,
  deleteMessagesAfter,
  updateMessageContent,
} from "@/features/ai-workspace/services/conversation-service";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string; messageId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id: conversationId, messageId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      content?: string;
      truncateAfter?: boolean;
    };

    if (body.content !== undefined) {
      await updateMessageContent(
        supabase,
        messageId,
        conversationId,
        auth.userId,
        body.content
      );
    }

    if (body.truncateAfter) {
      await deleteMessagesAfter(supabase, conversationId, auth.userId, messageId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: conversationId, messageId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    await deleteMessage(supabase, messageId, conversationId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
