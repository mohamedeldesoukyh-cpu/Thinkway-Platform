"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { splitSseBuffer } from "../services/sse-utils";
import { logMessageStateEvent } from "../debug/message-state-logger";
import type { AiActionCard, AiMessage, ChatRequestBody } from "../types";
import type { WorkflowProgressEvent, WorkflowResponseMetadata } from "@/features/ai-workflows";

export type ChatSendResult = {
  conversationId: string;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
  actionCards: AiActionCard[];
  workflowMetadata?: WorkflowResponseMetadata;
};

export type ChatSendFailure = {
  failed: true;
  conversationId?: string;
  error: string;
};

export type ChatSendCancelled = {
  cancelled: true;
  conversationId?: string;
  userMessageId?: string;
  partialContent: string;
  workflowProgress?: WorkflowStreamState | null;
};

export type WorkflowStreamState = {
  workflowId?: string;
  currentStep: number;
  totalSteps: number;
  progress: number;
  taskId?: string;
  taskTitle: string;
  status: string;
};

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) return "Chat request failed";

  try {
    const payload = JSON.parse(text) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? "Chat request failed";
  } catch {
    return text.slice(0, 200) || "Chat request failed";
  }
}

export type ChatSendOptions = {
  /** Re-run workflow from an existing user message (edit & re-run). Skips creating a duplicate user message. */
  rerunUserMessageId?: string;
  /** Skip optimistic user bubble — message already present locally (edit re-run or prompt re-send). */
  skipOptimisticUser?: boolean;
  /** Deictic focus so "this section" resolves to the studio card the user selected. */
  studioFocus?: ChatRequestBody["studioFocus"];
};

export function useAiChat(options: {
  conversationId?: string;
  workspace?: ChatRequestBody["workspace"];
  onConversationCreated?: (id: string) => void;
}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowStreamState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestWorkflowProgressRef = useRef<WorkflowStreamState | null>(null);
  const cancelledRef = useRef(false);
  const conversationIdDuringStreamRef = useRef<string | undefined>(undefined);
  const userMessageIdDuringStreamRef = useRef<string | undefined>(undefined);

  const setStreaming = useCallback((streaming: boolean) => {
    isStreamingRef.current = streaming;
    setIsStreaming(streaming);
  }, []);
  const contentRef = useRef("");
  const conversationIdRef = useRef(options.conversationId);
  const workspaceRef = useRef(options.workspace);
  const onConversationCreatedRef = useRef(options.onConversationCreated);

  useEffect(() => {
    conversationIdRef.current = options.conversationId;
    workspaceRef.current = options.workspace;
    onConversationCreatedRef.current = options.onConversationCreated;
  }, [options.conversationId, options.workspace, options.onConversationCreated]);

  const sendMessage = useCallback(
    async (
      message: string,
      intent?: ChatRequestBody["intent"],
      sendOptions?: ChatSendOptions
    ): Promise<ChatSendResult | ChatSendFailure | ChatSendCancelled | null> => {
      if (!message.trim() || isStreamingRef.current) return null;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      cancelledRef.current = false;

      contentRef.current = "";
      latestWorkflowProgressRef.current = null;
      conversationIdDuringStreamRef.current = conversationIdRef.current;
      userMessageIdDuringStreamRef.current = undefined;
      setStreaming(true);
      setStreamingContent("");
      setWorkflowProgress(null);
      setError(null);

      let conversationId = conversationIdRef.current ?? "";
      let userMessageId = "";
      let assistantMessageId = "";
      let agentId: string | undefined;
      let actionCards: AiActionCard[] = [];
      let workflowMetadata: WorkflowResponseMetadata | undefined;
      let streamCompleted = false;
      let streamError: string | null = null;
      let latestWorkflowProgress: WorkflowStreamState | null = null;

      const processEvent = (event: string, data: Record<string, unknown>) => {
        if (event === "start") {
          if (typeof data.conversationId === "string") {
            conversationId = data.conversationId;
            if (
              !conversationIdRef.current ||
              conversationIdRef.current !== data.conversationId
            ) {
              onConversationCreatedRef.current?.(data.conversationId);
            }
          }
          if (typeof data.userMessageId === "string") {
            userMessageId = data.userMessageId;
            userMessageIdDuringStreamRef.current = data.userMessageId;
          }
        }

        if (event === "delta" && typeof data.content === "string") {
          contentRef.current += data.content;
          setStreamingContent(contentRef.current);
        }

        if (event === "workflow_progress") {
          latestWorkflowProgress = {
            workflowId: typeof data.workflowId === "string" ? data.workflowId : undefined,
            currentStep: Number(data.step ?? 0),
            totalSteps: Number(data.totalSteps ?? 0),
            progress: Number(data.progress ?? 0),
            taskId: typeof data.taskId === "string" ? data.taskId : undefined,
            taskTitle: String(data.taskTitle ?? ""),
            status: String(data.status ?? "running"),
          };
          latestWorkflowProgressRef.current = latestWorkflowProgress;
          setWorkflowProgress(latestWorkflowProgress);
        }

        if (event === "workflow_step") {
          const step = data as unknown as WorkflowProgressEvent;
          latestWorkflowProgress = {
            workflowId: step.workflowId,
            currentStep: step.step,
            totalSteps: step.totalSteps,
            progress: step.progress,
            taskId: step.taskId,
            taskTitle: step.taskTitle,
            status: step.status,
          };
          latestWorkflowProgressRef.current = latestWorkflowProgress;
          setWorkflowProgress(latestWorkflowProgress);
        }

        if (event === "action_cards") {
          actionCards = (data.cards as AiActionCard[]) ?? [];
          if (typeof data.messageId === "string") {
            assistantMessageId = data.messageId;
          }
        }

        if (event === "done") {
          logMessageStateEvent("SSE done event", {
            messageId: data.messageId,
            workflow: data.workflow,
            workflowId: data.workflowId,
          });
          streamCompleted = true;
          if (typeof data.messageId === "string") {
            assistantMessageId = data.messageId;
          }
          if (typeof data.agentId === "string") {
            agentId = data.agentId;
          }
          if (data.workflow === true) {
            const metadataPayload = data.workflowMetadata as WorkflowResponseMetadata | undefined;
            if (metadataPayload?.workflow) {
              workflowMetadata = metadataPayload;
            } else if (typeof data.workflowId === "string") {
              workflowMetadata = {
                workflow: true,
                workflowId: data.workflowId as WorkflowResponseMetadata["workflowId"],
                workflowName: "",
                status: "completed",
                currentStep: latestWorkflowProgress?.currentStep ?? 0,
                totalSteps: latestWorkflowProgress?.totalSteps ?? 0,
                completedTasks: [],
                pendingTasks: [],
              };
            }
          }
          logMessageStateEvent("SSE done completed", {
            assistantMessageId,
            workflowMetadata: workflowMetadata?.workflowId,
          });
        }

        if (event === "error") {
          streamError = String(data.message ?? "Stream error");
          logMessageStateEvent("SSE error event", { message: streamError });
        }
      };

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message.trim(),
            conversationId: conversationIdRef.current,
            rerunUserMessageId: sendOptions?.rerunUserMessageId,
            intent,
            workspace: workspaceRef.current,
            studioFocus: sendOptions?.studioFocus,
          } satisfies ChatRequestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream available");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { events, remainder } = splitSseBuffer(buffer);
          buffer = remainder;

          for (const { event, data } of events) {
            processEvent(event, data);
            if (streamError) break;
          }
          if (streamError) break;
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          const { events } = splitSseBuffer(`${buffer}\n\n`);
          for (const { event, data } of events) {
            processEvent(event, data);
            if (streamError) break;
          }
        }

        if (streamError) {
          throw new Error(streamError);
        }

        if (!streamCompleted) {
          throw new Error(
            contentRef.current.trim()
              ? "Response ended unexpectedly. Your message was saved — try sending again."
              : "No response received. Please try again."
          );
        }

        const now = new Date().toISOString();
        const resolvedUserId =
          sendOptions?.rerunUserMessageId ||
          userMessageId ||
          `local_user_${Date.now()}`;
        const result: ChatSendResult = {
          conversationId,
          userMessage: {
            id: resolvedUserId,
            conversationId,
            role: "user",
            content: message.trim(),
            metadata: {},
            createdAt: now,
          },
          assistantMessage: {
            id: assistantMessageId || `local_asst_${Date.now()}`,
            conversationId,
            role: "assistant",
            content: contentRef.current,
            metadata: {
              agentId,
              actionCards,
              ...(workflowMetadata ?? {}),
            },
            createdAt: now,
          },
          actionCards,
          workflowMetadata,
        };

        setStreaming(false);
        setStreamingContent("");
        setWorkflowProgress(null);
        return result;
      } catch (err) {
        if (controller.signal.aborted || cancelledRef.current) {
          const partial = contentRef.current;
          setStreaming(false);
          setStreamingContent("");
          setWorkflowProgress(null);
          if (partial.trim()) {
            return {
              cancelled: true,
              conversationId: conversationId || conversationIdDuringStreamRef.current,
              userMessageId: userMessageId || userMessageIdDuringStreamRef.current,
              partialContent: partial,
              workflowProgress: latestWorkflowProgressRef.current,
            };
          }
          return {
            cancelled: true,
            conversationId: conversationId || conversationIdDuringStreamRef.current,
            userMessageId: userMessageId || userMessageIdDuringStreamRef.current,
            partialContent: "",
          };
        }

        const msg =
          err instanceof Error
            ? err.message.includes("Unexpected end of JSON input")
              ? "Connection interrupted. Your message may have been saved — refresh or try again."
              : err.message
            : "Chat failed";

        setError(msg);
        setStreaming(false);
        setStreamingContent("");
        setWorkflowProgress(null);

        return {
          failed: true,
          conversationId: conversationId || undefined,
          error: msg,
        };
      }
    },
    [setStreaming]
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingContent("");
    setWorkflowProgress(null);
  }, [setStreaming]);

  return {
    isStreaming,
    isStreamingRef,
    streamingContent,
    workflowProgress,
    error,
    sendMessage,
    cancel,
  };
}
