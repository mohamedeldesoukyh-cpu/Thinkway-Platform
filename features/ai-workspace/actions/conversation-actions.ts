"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  createConversation,
  deleteConversation,
  setConversationArchived,
  setConversationPinned,
  updateConversationTitle,
} from "../services/conversation-service";
import type { AiConversation, WorkspaceUrlParams } from "../types";
import { buildWorkspaceContextInput, normalizeWorkspaceContext } from "../services/workspace-context-service";

const AI_PATH = "/ai";

async function requireAiWrite() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return { ok: false as const, message: auth.error };
  }
  return { ok: true as const, supabase, userId: auth.userId };
}

export async function createConversationAction(
  workspace?: WorkspaceUrlParams
): Promise<{ ok: true; conversation: AiConversation } | { ok: false; message: string }> {
  const auth = await requireAiWrite();
  if (!auth.ok) return { ok: false, message: auth.message };

  try {
    const contextInput = await buildWorkspaceContextInput(
      auth.supabase,
      { id: auth.userId },
      workspace ?? {}
    );

    const conversation = await createConversation(auth.supabase, auth.userId, {
      workspaceType: contextInput.workspace?.type ?? "general",
      workspaceId: contextInput.workspace?.id,
      contextSnapshot: {
        workspace: normalizeWorkspaceContext(contextInput.workspace),
        campaign: contextInput.campaign,
        client: contextInput.client,
        shortlist: contextInput.shortlist,
      },
    });

    revalidatePath(AI_PATH);
    return { ok: true, conversation };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to create conversation",
    };
  }
}

export async function renameConversationAction(
  conversationId: string,
  title: string
): Promise<{ ok: boolean; message?: string }> {
  const auth = await requireAiWrite();
  if (!auth.ok) return { ok: false, message: auth.message };

  try {
    await updateConversationTitle(auth.supabase, conversationId, auth.userId, title);
    revalidatePath(AI_PATH);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Rename failed",
    };
  }
}

export async function pinConversationAction(
  conversationId: string,
  isPinned: boolean
): Promise<{ ok: boolean; message?: string }> {
  const auth = await requireAiWrite();
  if (!auth.ok) return { ok: false, message: auth.message };

  try {
    await setConversationPinned(auth.supabase, conversationId, auth.userId, isPinned);
    revalidatePath(AI_PATH);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Pin failed",
    };
  }
}

export async function archiveConversationAction(
  conversationId: string,
  archived: boolean
): Promise<{ ok: boolean; message?: string }> {
  const auth = await requireAiWrite();
  if (!auth.ok) return { ok: false, message: auth.message };

  try {
    await setConversationArchived(auth.supabase, conversationId, auth.userId, archived);
    revalidatePath(AI_PATH);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Archive failed",
    };
  }
}

export async function deleteConversationAction(
  conversationId: string
): Promise<{ ok: boolean; message?: string }> {
  const auth = await requireAiWrite();
  if (!auth.ok) return { ok: false, message: auth.message };

  try {
    await deleteConversation(auth.supabase, conversationId, auth.userId);
    revalidatePath(AI_PATH);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Delete failed",
    };
  }
}
