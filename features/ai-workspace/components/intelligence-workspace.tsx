"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

import { createConversationAction } from "../actions/conversation-actions";
import {
  createLoggedSetMessages,
  logMessageStateEvent,
} from "../debug/message-state-logger";
import { useAiChat } from "../hooks/use-ai-chat";
import { useConversations } from "../hooks/use-conversations";
import type { AiMessage, WorkspaceUrlParams } from "../types";
import { AiChatInput } from "./ai-chat-input";
import { AiWelcomeScreen } from "./ai-welcome-screen";
import { AiWorkspaceTopbar } from "./ai-workspace-topbar";
import { ChatThread } from "./chat-thread";
import { ConversationList } from "./conversation-list";
import { SuggestedActionsBar } from "./suggested-actions-bar";
import "./ai-workspace.css";

const SIDEBAR_COLLAPSED_KEY = "ai-workspace-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

function writeSidebarCollapsed(collapsed: boolean): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
}

type IntelligenceWorkspaceProps = {
  initialConversationId?: string;
  workspaceParams?: WorkspaceUrlParams;
  workspaceLabel?: string;
};

export function IntelligenceWorkspace({
  initialConversationId,
  workspaceParams,
  workspaceLabel,
}: IntelligenceWorkspaceProps) {
  const searchParams = useSearchParams();
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [messages, setMessagesRaw] = useState<AiMessage[]>([]);
  const setMessages = useMemo(
    () => createLoggedSetMessages(setMessagesRaw),
    [setMessagesRaw]
  );
  const [prompt, setPrompt] = useState("");
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingUserMessageId, setEditingUserMessageId] = useState<string | null>(null);

  const loadedConversationRef = useRef<string | null>(null);
  const editingUserMessageIdRef = useRef<string | null>(null);

  const { conversations, loading, error: conversationsError, refresh } = useConversations();

  useEffect(() => {
    setSidebarCollapsed(readSidebarCollapsed());
  }, []);

  useEffect(() => {
    editingUserMessageIdRef.current = editingUserMessageId;
  }, [editingUserMessageId]);

  useEffect(() => {
    setEditingUserMessageId(null);
  }, [conversationId]);

  useEffect(() => {
    if (!initialConversationId) return;
    setConversationId((current) => {
      if (current === initialConversationId) return current;
      loadedConversationRef.current = null;
      return initialConversationId;
    });
  }, [initialConversationId]);

  const handleSidebarCollapsedChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    writeSidebarCollapsed(collapsed);
  }, []);

  const workspace = useMemo((): WorkspaceUrlParams => {
    if (workspaceParams) return workspaceParams;
    return {
      workspace: searchParams.get("workspace") ?? undefined,
      id: searchParams.get("id") ?? undefined,
      campaignId: searchParams.get("campaignId") ?? undefined,
      clientId: searchParams.get("clientId") ?? undefined,
      shortlistId: searchParams.get("shortlistId") ?? undefined,
      brandId: searchParams.get("brandId") ?? undefined,
      groupId: searchParams.get("groupId") ?? undefined,
    };
  }, [workspaceParams, searchParams]);

  const syncConversationUrl = useCallback(
    (id: string, options?: { replace?: boolean }) => {
      const path = `/ai/${id}${buildQueryString(workspace)}`;
      if (typeof window === "undefined") return;

      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (currentPath === path) return;

      if (options?.replace === false) {
        window.history.pushState(null, "", path);
      } else {
        window.history.replaceState(null, "", path);
      }
    },
    [workspace]
  );

  const handleConversationCreated = useCallback(
    (id: string) => {
      logMessageStateEvent("handleConversationCreated", { id });
      setConversationId(id);
      syncConversationUrl(id, { replace: true });
      void refresh({ background: true });
    },
    [refresh, syncConversationUrl]
  );

  const { isStreaming, isStreamingRef, streamingContent, workflowProgress, error, sendMessage, cancel } =
    useAiChat({
      conversationId,
      workspace,
      onConversationCreated: handleConversationCreated,
    });

  const handleStop = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser?.content.trim()) {
      setPrompt(lastUser.content);
    }
    cancel();
  }, [cancel, messages]);

  const loadConversation = useCallback(
    async (id: string, force = false) => {
      logMessageStateEvent("loadConversation called", { id, force });
      if (!force && loadedConversationRef.current === id) {
        logMessageStateEvent("loadConversation skipped (already loaded)", { id });
        return;
      }
      if (isStreamingRef.current) {
        logMessageStateEvent("loadConversation skipped (streaming)", { id });
        return;
      }
      if (editingUserMessageIdRef.current) {
        logMessageStateEvent("loadConversation skipped (editing)", { id });
        return;
      }

      logMessageStateEvent("loadConversation fetch started", { id, force });
      setLoadingConversation(true);
      try {
        const response = await fetch(`/api/ai/conversations/${id}`);
        if (!response.ok) {
          logMessageStateEvent("loadConversation fetch failed", {
            id,
            status: response.status,
          });
          return;
        }
        const data = (await response.json()) as {
          conversation: { messages?: AiMessage[] };
        };
        const fetched = data.conversation.messages ?? [];
        logMessageStateEvent("loadConversation replacing messages", {
          id,
          fetchedCount: fetched.length,
          fetchedRoles: fetched.map((m) => m.role),
        });
        setMessages(fetched, "loadConversation");
        loadedConversationRef.current = id;
        logMessageStateEvent("loadConversation completed", {
          id,
          messageCount: fetched.length,
        });
      } finally {
        setLoadingConversation(false);
      }
    },
    [setMessages]
  );

  useEffect(() => {
    if (!conversationId) {
      loadedConversationRef.current = null;
      return;
    }
    if (isStreamingRef.current) {
      logMessageStateEvent("conversationId effect skipped (streaming)", {
        conversationId,
      });
      return;
    }
    if (editingUserMessageIdRef.current) {
      logMessageStateEvent("conversationId effect skipped (editing)", {
        conversationId,
      });
      return;
    }
    if (loadedConversationRef.current === conversationId) {
      logMessageStateEvent("conversationId effect skipped (already loaded)", {
        conversationId,
      });
      return;
    }
    logMessageStateEvent("conversationId effect triggering loadConversation", {
      conversationId,
    });
    void loadConversation(conversationId);
  }, [conversationId, loadConversation]);

  const deleteMessageOnServer = useCallback(
    async (messageId: string) => {
      if (!conversationId || messageId.startsWith("optimistic_") || messageId.startsWith("partial_")) {
        return;
      }
      await fetch(`/api/ai/conversations/${conversationId}/messages/${messageId}`, {
        method: "DELETE",
      });
    },
    [conversationId]
  );

  const handleSend = useCallback(
    async (
      text?: string,
      intent?: Parameters<typeof sendMessage>[1],
      sendOptions?: Parameters<typeof sendMessage>[2]
    ) => {
      const message = (text ?? prompt).trim();
      if (!message) return;

      const skipOptimisticUser = sendOptions?.skipOptimisticUser === true;
      const rerunUserMessageId = sendOptions?.rerunUserMessageId;

      if (!skipOptimisticUser && !rerunUserMessageId) {
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const hasPartialAssistant = messages.some((m) => m.id.startsWith("partial_"));
        if (
          lastUser &&
          lastUser.content.trim() === message &&
          (hasPartialAssistant || messages[messages.length - 1]?.role === "assistant")
        ) {
          const userIndex = messages.findIndex((m) => m.id === lastUser.id);
          const trailingIds = messages.slice(userIndex + 1).map((m) => m.id);
          setMessages(
            (prev) => prev.slice(0, userIndex + 1),
            "handleSend:rerunFromPrompt"
          );
          for (const id of trailingIds) {
            void deleteMessageOnServer(id);
          }
          sendOptions = {
            ...sendOptions,
            rerunUserMessageId: lastUser.id.startsWith("optimistic_") ? undefined : lastUser.id,
            skipOptimisticUser: true,
          };
        }
      }

      const effectiveSkipOptimistic =
        sendOptions?.skipOptimisticUser === true || Boolean(sendOptions?.rerunUserMessageId);

      setPrompt("");
      if (!effectiveSkipOptimistic) {
        logMessageStateEvent("handleSend optimistic user message", { message });
        setMessages(
          (prev) => [
            ...prev,
            {
              id: `optimistic_${Date.now()}`,
              conversationId: conversationId ?? "",
              role: "user",
              content: message,
              metadata: {},
              createdAt: new Date().toISOString(),
            },
          ],
          "handleSend:optimisticUser"
        );
      }

      const result = await sendMessage(message, intent, sendOptions);
      if (result && !("failed" in result) && !("cancelled" in result)) {
        logMessageStateEvent("handleSend onWorkflowComplete", {
          workflowId: result.workflowMetadata?.workflowId,
          conversationId: result.conversationId,
        });
        loadedConversationRef.current = result.conversationId;
        if (result.workflowMetadata?.workflowId === "create-campaign") {
          logMessageStateEvent("handleSend create-campaign reload path", {
            conversationId: result.conversationId,
          });
          loadedConversationRef.current = null;
          await loadConversation(result.conversationId, true);
        } else if (effectiveSkipOptimistic) {
          setMessages(
            (prev) => {
              const withoutTransient = prev.filter(
                (m) => !m.id.startsWith("optimistic_") && !m.id.startsWith("partial_")
              );
              const userMessageId = result.userMessage.id;
              const existingUserIndex = withoutTransient.findIndex((m) => m.id === userMessageId);
              const base =
                existingUserIndex >= 0
                  ? withoutTransient.slice(0, existingUserIndex + 1).map((m) =>
                      m.id === userMessageId ? { ...m, content: result.userMessage.content } : m
                    )
                  : [...withoutTransient, result.userMessage];
              return [...base, result.assistantMessage];
            },
            "handleSend:mergeRerunResult"
          );
        } else {
          setMessages(
            (prev) => {
              const withoutOptimistic = prev.filter(
                (m) => !m.id.startsWith("optimistic_")
              );
              return [
                ...withoutOptimistic,
                result.userMessage,
                result.assistantMessage,
              ];
            },
            "handleSend:mergeResult"
          );
        }
        if (!conversationId || conversationId !== result.conversationId) {
          logMessageStateEvent("handleSend updating conversationId", {
            from: conversationId,
            to: result.conversationId,
          });
          setConversationId(result.conversationId);
          syncConversationUrl(result.conversationId, { replace: true });
        }
        void refresh({ background: true });
      } else if (result && "failed" in result) {
        logMessageStateEvent("handleSend failed", { error: result.error });
        setMessages(
          (prev) => prev.filter((m) => !m.id.startsWith("optimistic_")),
          "handleSend:failedRemoveOptimistic"
        );
        const idToReload = result.conversationId ?? conversationId;
        if (idToReload) {
          loadedConversationRef.current = null;
          void loadConversation(idToReload, true);
        }
        void refresh({ background: true });
      } else if (result && "cancelled" in result) {
        logMessageStateEvent("handleSend cancelled", {
          partialLength: result.partialContent.length,
        });

        const convId = result.conversationId ?? conversationId ?? "";
        const optimisticUser = messages.find((m) => m.id.startsWith("optimistic_"));
        const lastUserContent =
          optimisticUser?.content ??
          [...messages].reverse().find((m) => m.role === "user")?.content ??
          "";

        if (result.partialContent.trim()) {
          setMessages(
            (prev) => {
              const optimisticUser = prev.find((m) => m.id.startsWith("optimistic_"));
              const withoutTransient = prev.filter(
                (m) => !m.id.startsWith("optimistic_") && !m.id.startsWith("partial_")
              );
              const now = new Date().toISOString();
              const userMessageId =
                result.userMessageId && !result.userMessageId.startsWith("optimistic_")
                  ? result.userMessageId
                  : `local_user_${Date.now()}`;
              const userContent =
                optimisticUser?.content ??
                withoutTransient.filter((m) => m.role === "user").at(-1)?.content ??
                "";

              const next = withoutTransient.filter((m) => m.id !== userMessageId);

              if (userContent.trim()) {
                next.push({
                  id: userMessageId,
                  conversationId: convId,
                  role: "user",
                  content: userContent,
                  metadata: {},
                  createdAt: now,
                });
              }

              next.push({
                id: `partial_${Date.now()}`,
                conversationId: convId,
                role: "assistant",
                content: result.partialContent,
                metadata: { stopped: true },
                createdAt: now,
              });

              return next;
            },
            "handleSend:cancelledWithPartial"
          );
          if (lastUserContent.trim()) setPrompt(lastUserContent);
          if (convId) loadedConversationRef.current = convId;
        } else {
          setMessages(
            (prev) => {
              const optimisticUser = prev.find((m) => m.id.startsWith("optimistic_"));
              const withoutTransient = prev.filter(
                (m) => !m.id.startsWith("optimistic_") && !m.id.startsWith("partial_")
              );
              const now = new Date().toISOString();
              const userMessageId =
                result.userMessageId && !result.userMessageId.startsWith("optimistic_")
                  ? result.userMessageId
                  : `local_user_${Date.now()}`;
              const userContent =
                optimisticUser?.content ??
                withoutTransient.filter((m) => m.role === "user").at(-1)?.content ??
                "";

              const next = withoutTransient.filter((m) => m.id !== userMessageId);

              if (userContent.trim()) {
                next.push({
                  id: userMessageId,
                  conversationId: convId,
                  role: "user",
                  content: userContent,
                  metadata: {},
                  createdAt: now,
                });
              }

              return next;
            },
            "handleSend:cancelledKeepUser"
          );
          if (lastUserContent.trim()) setPrompt(lastUserContent);
          if (convId) loadedConversationRef.current = convId;
        }
      } else {
        setMessages(
          (prev) => prev.filter((m) => !m.id.startsWith("optimistic_")),
          "handleSend:cancelledRemoveOptimistic"
        );
      }
    },
    [prompt, conversationId, messages, sendMessage, refresh, loadConversation, syncConversationUrl, setMessages, deleteMessageOnServer]
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      setMessages(
        (prev) => prev.filter((m) => m.id !== messageId),
        "handleDeleteMessage"
      );
      void deleteMessageOnServer(messageId);
    },
    [setMessages, deleteMessageOnServer]
  );

  const handleRetryMessage = useCallback(
    async (message: AiMessage) => {
      if (isStreaming || !conversationId) return;

      if (message.role === "assistant") {
        const index = messages.findIndex((m) => m.id === message.id);
        const priorUser = index > 0
          ? [...messages.slice(0, index)].reverse().find((m) => m.role === "user")
          : undefined;
        if (!priorUser) return;

        setMessages(
          (prev) => prev.filter((m) => m.id !== message.id),
          "handleRetry:removeAssistant"
        );
        if (!message.id.startsWith("optimistic_") && !message.id.startsWith("partial_")) {
          void deleteMessageOnServer(message.id);
        }
        await handleSend(priorUser.content);
        return;
      }

      const userIndex = messages.findIndex((m) => m.id === message.id);
      if (userIndex < 0) return;
      const trailingIds = messages.slice(userIndex + 1).map((m) => m.id);

      setMessages(
        (prev) => prev.slice(0, userIndex + 1),
        "handleRetry:truncateAfterUser"
      );
      for (const id of trailingIds) {
        void deleteMessageOnServer(id);
      }
      await handleSend(message.content);
    },
    [isStreaming, conversationId, messages, setMessages, deleteMessageOnServer, handleSend]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (isStreaming || !conversationId) return;

      setEditingUserMessageId(null);

      const userIndex = messages.findIndex((m) => m.id === messageId);
      if (userIndex < 0) return;
      const trailingIds = messages.slice(userIndex + 1).map((m) => m.id);

      setMessages(
        (prev) =>
          prev
            .slice(0, userIndex + 1)
            .map((m) => (m.id === messageId ? { ...m, content: newContent } : m)),
        "handleEdit:updateUser"
      );

      const isPersistedMessage =
        !messageId.startsWith("optimistic_") && !messageId.startsWith("partial_");

      if (isPersistedMessage) {
        await fetch(`/api/ai/conversations/${conversationId}/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newContent, truncateAfter: true }),
        });
      } else {
        for (const id of trailingIds) {
          void deleteMessageOnServer(id);
        }
      }

      await handleSend(newContent, undefined, {
        rerunUserMessageId: isPersistedMessage ? messageId : undefined,
        skipOptimisticUser: true,
      });
    },
    [isStreaming, conversationId, messages, setMessages, deleteMessageOnServer, handleSend]
  );

  const handleEditCancel = useCallback(() => {
    setEditingUserMessageId(null);
  }, []);

  const handleNewChat = useCallback(async () => {
    setCreateError(null);
    try {
      const result = await createConversationAction(workspace);
      if (result.ok) {
        setConversationId(result.conversation.id);
        setMessages([], "handleNewChat:clear");
        loadedConversationRef.current = result.conversation.id;
        syncConversationUrl(result.conversation.id, { replace: true });
        void refresh({ background: true });
      } else {
        setCreateError(result.message);
      }
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create conversation"
      );
    }
  }, [workspace, refresh, syncConversationUrl, setMessages]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === conversationId) return;
      logMessageStateEvent("handleSelectConversation", { from: conversationId, to: id });
      setConversationId(id);
      loadedConversationRef.current = null;
      syncConversationUrl(id, { replace: true });
    },
    [conversationId, syncConversationUrl]
  );

  const handleVendorDecisionsUpdated = useCallback(
    (
      messageId: string,
      decisions: Record<string, "approved" | "rejected" | "shortlisted">
    ) => {
      setMessages(
        (prev) =>
          prev.map((message) => {
            if (message.id !== messageId) return message;
            const campaignObject = message.metadata.campaignObject as
              | Record<string, unknown>
              | undefined;
            if (!campaignObject) return message;
            const sections = (campaignObject.sections ?? {}) as Record<string, unknown>;
            const creators = (sections.creators ?? {}) as Record<string, unknown>;
            const data = (creators.data ?? {}) as Record<string, unknown>;
            return {
              ...message,
              metadata: {
                ...message.metadata,
                campaignObject: {
                  ...campaignObject,
                  sections: {
                    ...sections,
                    creators: {
                      ...creators,
                      data: { ...data, vendorDecisions: decisions },
                    },
                  },
                },
              },
            };
          }),
        "handleVendorDecisionsUpdated"
      );
    },
    [setMessages]
  );

  const handleCardUpdated = useCallback(
    (messageId: string, cardId: string, status: string) => {
      setMessages(
        (prev) =>
          prev.map((message) => {
            if (message.id !== messageId) return message;
            return {
              ...message,
              metadata: {
                ...message.metadata,
                actionCards: message.metadata.actionCards?.map((card) =>
                  card.id === cardId
                    ? { ...card, status: status as typeof card.status }
                    : card
                ),
              },
            };
          }),
        "handleCardUpdated"
      );
    },
    [setMessages]
  );

  const showEmptyState =
    messages.length === 0 && !isStreaming && !loadingConversation;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <AiWorkspaceTopbar workspace={workspace} workspaceLabel={workspaceLabel} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ConversationList
          className="hidden lg:flex"
          conversations={conversations}
          loading={loading}
          error={conversationsError}
          activeId={conversationId}
          collapsed={sidebarCollapsed}
          onCollapsedChange={handleSidebarCollapsedChange}
          onSelect={handleSelectConversation}
          onNewChat={() => void handleNewChat()}
          onRefresh={() => void refresh({ background: true })}
        />

        <div
          className={cn(
            "ai-main-surface flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          )}
        >
          {loadingConversation && messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <span className="ai-spinner size-6" />
              <p className="text-xs text-muted-foreground">Loading conversation…</p>
            </div>
          ) : showEmptyState ? (
            <AiWelcomeScreen
              onSelect={(p, intent) => void handleSend(p, intent)}
              disabled={isStreaming}
            />
          ) : (
            <>
              <ChatThread
                messages={messages}
                streamingContent={streamingContent}
                isStreaming={isStreaming}
                workflowProgress={workflowProgress}
                conversationId={conversationId}
                editingUserMessageId={editingUserMessageId}
                onEditStart={setEditingUserMessageId}
                onEditCancel={handleEditCancel}
                onCardUpdated={handleCardUpdated}
                onVendorDecisionsUpdated={handleVendorDecisionsUpdated}
                onEditMessage={(id, content) => void handleEditMessage(id, content)}
                onRetryMessage={(message) => void handleRetryMessage(message)}
                onDeleteMessage={handleDeleteMessage}
              />
              <SuggestedActionsBar
                onSelect={(p, intent) => void handleSend(p, intent)}
                disabled={isStreaming}
                messages={messages}
                workspace={workspace}
              />
            </>
          )}

          <AiChatInput
            value={prompt}
            onChange={setPrompt}
            onSend={() => void handleSend()}
            onStop={() => void handleStop()}
            onNewChat={() => void handleNewChat()}
            disabled={loadingConversation && messages.length === 0}
            isStreaming={isStreaming}
            error={createError ?? error}
          />
        </div>
      </div>
    </div>
  );
}

function buildQueryString(workspace: WorkspaceUrlParams): string {
  const params = new URLSearchParams();
  if (workspace.workspace) params.set("workspace", workspace.workspace);
  if (workspace.id) params.set("id", workspace.id);
  if (workspace.campaignId) params.set("campaignId", workspace.campaignId);
  if (workspace.clientId) params.set("clientId", workspace.clientId);
  if (workspace.shortlistId) params.set("shortlistId", workspace.shortlistId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
