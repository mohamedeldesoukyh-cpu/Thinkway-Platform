import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  createConversation,
  listConversations,
} from "@/features/ai-workspace/services/conversation-service";
import { buildWorkspaceContextInput, normalizeWorkspaceContext } from "@/features/ai-workspace/services/workspace-context-service";
import type { WorkspaceUrlParams } from "@/features/ai-workspace/types";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const conversations = await listConversations(supabase, auth.userId);
    return NextResponse.json({ conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { workspace?: WorkspaceUrlParams; title?: string };
    const contextInput = await buildWorkspaceContextInput(
      supabase,
      { id: auth.userId },
      body.workspace ?? {}
    );

    const conversation = await createConversation(supabase, auth.userId, {
      title: body.title,
      workspaceType: contextInput.workspace?.type ?? "general",
      workspaceId: contextInput.workspace?.id,
      contextSnapshot: {
        workspace: normalizeWorkspaceContext(contextInput.workspace),
        campaign: contextInput.campaign,
        client: contextInput.client,
        shortlist: contextInput.shortlist,
      },
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
