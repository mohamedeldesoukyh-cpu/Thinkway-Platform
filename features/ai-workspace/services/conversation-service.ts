import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiContext, WorkspaceType } from "@/features/ai";

import type {
  AiConversation,
  AiConversationRow,
  AiConversationStatus,
  AiMessage,
  AiMessageRow,
  ConversationListItem,
} from "../types";

function mapConversation(row: AiConversationRow): AiConversation {
  return {
    id: row.id,
    title: row.title,
    workspaceType: row.workspace_type as WorkspaceType,
    workspaceId: row.workspace_id ?? undefined,
    contextSnapshot: (row.context_snapshot ?? {}) as Partial<AiContext>,
    status: row.status,
    isPinned: row.is_pinned,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: AiMessageRow): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: (row.metadata ?? {}) as AiMessage["metadata"],
    createdAt: row.created_at,
  };
}

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
  options: { includeArchived?: boolean; limit?: number } = {}
): Promise<ConversationListItem[]> {
  const limit = options.limit ?? 50;

  let query = supabase
    .from("ai_conversations")
    .select("id, title, is_pinned, status, updated_at, workspace_type, workspace_id")
    .eq("created_by", userId)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!options.includeArchived) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    isPinned: row.is_pinned,
    status: row.status as AiConversationStatus,
    updatedAt: row.updated_at,
    workspaceType: row.workspace_type,
    workspaceId: row.workspace_id ?? undefined,
  }));
}

export async function getConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<AiConversation | null> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("created_by", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapConversation(data as AiConversationRow);
}

export async function getConversationWithMessages(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<AiConversation | null> {
  const conversation = await getConversation(supabase, conversationId, userId);
  if (!conversation) return null;

  const { data: messages, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return {
    ...conversation,
    messages: (messages ?? []).map((row) => mapMessage(row as AiMessageRow)),
  };
}

export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  input: {
    title?: string;
    workspaceType?: WorkspaceType | string;
    workspaceId?: string;
    contextSnapshot?: Partial<AiContext>;
  } = {}
): Promise<AiConversation> {
  const id = randomUUID();
  const title = input.title?.trim() || "New conversation";
  const workspaceType = input.workspaceType ?? "general";
  const workspaceId = input.workspaceId ?? null;
  const contextSnapshot = input.contextSnapshot ?? {};
  const now = new Date().toISOString();

  // Insert without RETURNING — PostgREST evaluates SELECT RLS on .select() after
  // insert, which can fail even when INSERT WITH CHECK passes (Sprint 6.3).
  const { error } = await supabase.from("ai_conversations").insert({
    id,
    title,
    workspace_type: workspaceType,
    workspace_id: workspaceId,
    context_snapshot: contextSnapshot,
    created_by: userId,
  });

  if (error) throw new Error(error.message);

  return {
    id,
    title,
    workspaceType,
    workspaceId: workspaceId ?? undefined,
    contextSnapshot: contextSnapshot as AiConversation["contextSnapshot"],
    status: "active",
    isPinned: false,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function appendMessage(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    role: AiMessage["role"];
    content: string;
    metadata?: AiMessage["metadata"];
  }
): Promise<AiMessage> {
  const id = randomUUID();
  const metadata = input.metadata ?? {};
  const now = new Date().toISOString();

  // Insert without RETURNING — avoids ai_messages SELECT RLS on RETURNING.
  const { error } = await supabase.from("ai_messages").insert({
    id,
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    metadata,
  });

  if (error) throw new Error(error.message);

  return {
    id,
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    metadata,
    createdAt: now,
  };
}

export async function updateConversationContextSnapshot(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  contextSnapshot: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ context_snapshot: contextSnapshot })
    .eq("id", conversationId)
    .eq("created_by", userId);

  if (error) throw new Error(error.message);
}

export async function updateConversationTitle(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  title: string
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required.");

  const { error } = await supabase
    .from("ai_conversations")
    .update({ title: trimmed })
    .eq("id", conversationId)
    .eq("created_by", userId);

  if (error) throw new Error(error.message);
}

export async function setConversationPinned(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  isPinned: boolean
): Promise<void> {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ is_pinned: isPinned })
    .eq("id", conversationId)
    .eq("created_by", userId);

  if (error) throw new Error(error.message);
}

export async function setConversationArchived(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  archived: boolean
): Promise<void> {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", conversationId)
    .eq("created_by", userId);

  if (error) throw new Error(error.message);
}

export async function deleteConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("created_by", userId);

  if (error) throw new Error(error.message);
}

export async function updateMessageMetadata(
  supabase: SupabaseClient,
  messageId: string,
  metadata: AiMessage["metadata"]
): Promise<void> {
  const { error } = await supabase
    .from("ai_messages")
    .update({ metadata })
    .eq("id", messageId);

  if (error) throw new Error(error.message);
}

export async function updateMessageContent(
  supabase: SupabaseClient,
  messageId: string,
  conversationId: string,
  userId: string,
  content: string
): Promise<void> {
  const conversation = await getConversation(supabase, conversationId, userId);
  if (!conversation) throw new Error("Conversation not found");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message content is required");

  const { error } = await supabase
    .from("ai_messages")
    .update({ content: trimmed })
    .eq("id", messageId)
    .eq("conversation_id", conversationId);

  if (error) throw new Error(error.message);
}

export async function deleteMessage(
  supabase: SupabaseClient,
  messageId: string,
  conversationId: string,
  userId: string
): Promise<void> {
  const conversation = await getConversation(supabase, conversationId, userId);
  if (!conversation) throw new Error("Conversation not found");

  const { error } = await supabase
    .from("ai_messages")
    .delete()
    .eq("id", messageId)
    .eq("conversation_id", conversationId);

  if (error) throw new Error(error.message);
}

export async function deleteMessagesAfter(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  afterMessageId: string
): Promise<void> {
  const conversation = await getConversation(supabase, conversationId, userId);
  if (!conversation) throw new Error("Conversation not found");

  const { data: anchor, error: anchorError } = await supabase
    .from("ai_messages")
    .select("created_at")
    .eq("id", afterMessageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (anchorError) throw new Error(anchorError.message);
  if (!anchor) throw new Error("Message not found");

  const { error } = await supabase
    .from("ai_messages")
    .delete()
    .eq("conversation_id", conversationId)
    .gt("created_at", anchor.created_at);

  if (error) throw new Error(error.message);
}

export function deriveConversationTitle(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed || "New conversation";
  return `${trimmed.slice(0, 57)}…`;
}
