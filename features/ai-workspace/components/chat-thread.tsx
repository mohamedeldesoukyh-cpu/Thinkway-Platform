"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { CampaignStudioHost } from "@/features/campaign-decision-workspace/components/campaign-studio-host";
import { isCampaignWorkflow } from "@/features/campaign-studio/constants/workflow-ids";
import { isOperationalCampaignBrief } from "@/features/ai/routing/operational-detection";
import { stripConversationalFiller } from "@/features/ai-workflows/formatters/creator-formatter";
import { cn } from "@/lib/utils";

import { shouldHideCampaignStudioCaption, shouldHideWorkflowMarkdown } from "../constants/ai-copy";
import type { AiActionCard, AiMessage } from "../types";
import type { WorkflowStreamState } from "../hooks/use-ai-chat";
import { ActionCardRenderer } from "./action-card-renderer";
import { AiOrbIcon } from "./ai-orb-icon";
import { EditMessageForm, MessageActions } from "./message-actions";
import {
  WorkflowDashboardPanel,
  isWorkflowMetadata,
  toWorkflowDisplayMetadata,
} from "./workflow-dashboard-panel";

const SCROLL_THRESHOLD_PX = 80;

type ChatThreadProps = {
  messages: AiMessage[];
  streamingContent?: string;
  isStreaming?: boolean;
  workflowProgress?: WorkflowStreamState | null;
  conversationId?: string;
  editingUserMessageId?: string | null;
  onEditStart?: (messageId: string) => void;
  onEditCancel?: () => void;
  onCardUpdated?: (messageId: string, cardId: string, status: string) => void;
  onVendorDecisionsUpdated?: (
    messageId: string,
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRetryMessage?: (message: AiMessage) => void;
  onDeleteMessage?: (messageId: string) => void;
  onScrollContainerChange?: (node: HTMLDivElement | null) => void;
  className?: string;
};

export function ChatThread({
  messages,
  streamingContent,
  isStreaming,
  workflowProgress,
  conversationId,
  editingUserMessageId = null,
  onEditStart,
  onEditCancel,
  onCardUpdated,
  onVendorDecisionsUpdated,
  onEditMessage,
  onRetryMessage,
  onDeleteMessage,
  onScrollContainerChange,
  className,
}: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showNewUpdates, setShowNewUpdates] = useState(false);
  const [chatScrollContainer, setChatScrollContainer] = useState<HTMLDivElement | null>(null);

  const bindScrollContainer = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      setChatScrollContainer(node);
      onScrollContainerChange?.(node);
    },
    [onScrollContainerChange]
  );

  const progressWorkflowId = workflowProgress?.workflowId;
  const progressStep = workflowProgress?.currentStep;
  const progressTaskId = workflowProgress?.taskId;

  const visibleMessages = useMemo(
    () => collapseDuplicateCampaignStudioMessages(messages),
    [messages]
  );

  const lastUserMessageId = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      if (visibleMessages[i]?.role === "user") return visibleMessages[i].id;
    }
    return undefined;
  }, [visibleMessages]);

  const checkIsAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    isAtBottomRef.current = true;
    setShowNewUpdates(false);
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom(isStreaming ? "auto" : "smooth");
    } else {
      setShowNewUpdates(true);
    }
  }, [
    visibleMessages,
    streamingContent,
    isStreaming,
    progressWorkflowId,
    progressStep,
    progressTaskId,
    scrollToBottom,
  ]);

  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom();
    isAtBottomRef.current = atBottom;
    if (atBottom) setShowNewUpdates(false);
  }, [checkIsAtBottom]);

  const anticipatedCampaignWorkflowId = useMemo(() => {
    if (!isStreaming || workflowProgress) return undefined;
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUser?.content.trim()) return undefined;
    return isOperationalCampaignBrief(lastUser.content.trim()) ? "create-campaign" : undefined;
  }, [isStreaming, workflowProgress, messages]);

  const streamingStudioInput = useMemo(() => {
    if (workflowProgress) {
      return {
        workflowId: workflowProgress.workflowId,
        workflowName: "Create Campaign",
        workflowStatus: "running" as const,
        currentStep: workflowProgress.currentStep,
        totalSteps: workflowProgress.totalSteps,
        progressPercent: workflowProgress.progress,
        taskId: workflowProgress.taskId,
        taskTitle: workflowProgress.taskTitle,
        taskStatus: workflowProgress.status,
      };
    }

    if (!anticipatedCampaignWorkflowId) return null;

    return {
      workflowId: anticipatedCampaignWorkflowId,
      workflowName: "Create Campaign",
      workflowStatus: "running" as const,
      currentStep: 0,
      totalSteps: 8,
      progressPercent: 0,
      taskTitle: "Campaign Studio",
      taskStatus: "running",
    };
  }, [workflowProgress, anticipatedCampaignWorkflowId]);

  const hasContent = messages.length > 0 || isStreaming;

  if (!hasContent) {
    return null;
  }

  const streamingCampaignStudio =
    isStreaming && isCampaignWorkflow(streamingStudioInput?.workflowId);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={bindScrollContainer}
        onScroll={handleScroll}
        className={cn(
        "flex h-full min-h-0 flex-col gap-0 overflow-y-auto overscroll-contain pb-[var(--ai-composer-scroll-pad,6rem)] pt-[var(--ai-topbar-scroll-pad,4.25rem)]",
          "[scrollbar-color:#e2e8f0_transparent] [scrollbar-width:thin]",
          className
        )}
        data-chat-scroll-root
      >
        {visibleMessages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            conversationId={conversationId}
            chatScrollContainer={chatScrollContainer}
            isLastUserMessage={message.id === lastUserMessageId}
            isEditing={editingUserMessageId === message.id}
            isStreaming={isStreaming}
            onCardUpdated={onCardUpdated}
            onVendorDecisionsUpdated={onVendorDecisionsUpdated}
            onEdit={() => onEditStart?.(message.id)}
            onEditSave={(content) => {
              onEditCancel?.();
              onEditMessage?.(message.id, content);
            }}
            onEditCancel={() => onEditCancel?.()}
            onRetry={() => onRetryMessage?.(message)}
            onDelete={() => onDeleteMessage?.(message.id)}
          />
        ))}

        {isStreaming ? (
          streamingCampaignStudio && streamingStudioInput ? (
            <div className="studio-chat-embed ai-msg-in-fade">
              <CampaignStudioHost
                {...streamingStudioInput}
                scrollContainer={chatScrollContainer}
              />
            </div>
          ) : (
            <div className="ai-msg-in flex gap-2.5 px-6">
              <AiOrbIcon size="md" className="mt-0.5 shadow-[0_2px_8px_rgba(124,58,237,0.35)]" />
              <div className="max-w-[72%] rounded-[4px_12px_12px_12px] border border-border bg-background px-4 py-3.5 text-[13px] leading-relaxed shadow-sm">
                {workflowProgress ? (
                  <WorkflowStreamingIndicator progress={workflowProgress} />
                ) : null}
                {streamingContent ? (
                  <MarkdownLite content={streamingContent} />
                ) : !workflowProgress ? (
                  <TypingIndicator />
                ) : null}
              </div>
            </div>
          )
        ) : null}

        <div ref={bottomRef} />
      </div>

      {showNewUpdates ? (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-[calc(var(--ai-composer-scroll-pad,6rem)+0.5rem)] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-md transition hover:bg-muted"
        >
          <ChevronDownIcon className="size-3.5" />
          New updates
        </button>
      ) : null}
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({
  message,
  conversationId,
  chatScrollContainer,
  isLastUserMessage,
  isEditing,
  isStreaming,
  onCardUpdated,
  onVendorDecisionsUpdated,
  onEdit,
  onEditSave,
  onEditCancel,
  onRetry,
  onDelete,
}: {
  message: AiMessage;
  conversationId?: string;
  chatScrollContainer?: HTMLDivElement | null;
  isLastUserMessage?: boolean;
  isEditing?: boolean;
  isStreaming?: boolean;
  onCardUpdated?: (messageId: string, cardId: string, status: string) => void;
  onVendorDecisionsUpdated?: (
    messageId: string,
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  onEdit?: () => void;
  onEditSave?: (content: string) => void;
  onEditCancel?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
}) {
  const isUser = message.role === "user";
  const metadata = message.metadata;
  const isCampaignStudioMessage =
    !isUser &&
    isWorkflowMetadata(metadata) &&
    isCampaignWorkflow(metadata.workflowId);

  const campaignDisplay = useMemo(
    () =>
      isCampaignStudioMessage ? toWorkflowDisplayMetadata(metadata) : null,
    [
      isCampaignStudioMessage,
      message.id,
      metadata.workflowId,
      metadata.workflowStatus,
      metadata.workflowStep,
      metadata.status,
      metadata.campaignObject,
      metadata.summarySections,
      metadata.completedTasks,
      metadata.pendingTasks,
      metadata.clarificationQuestion,
      metadata.inferredFields,
      metadata.actionCards,
    ]
  );

  const actionsDisabled = Boolean(isStreaming);

  if (isUser) {
    return (
      <div className="group ai-msg-in mb-[18px] flex justify-end px-6">
        <div
          className={cn(
            "flex flex-col gap-1",
            isEditing ? "max-w-[min(100%,720px)]" : "max-w-[72%]"
          )}
        >
          <div
            className={cn(
              "ai-gradient-user-bubble self-end rounded-[12px_4px_12px_12px] px-4 py-3 text-left text-[13px] leading-relaxed text-white shadow-[0_4px_16px_rgba(37,99,235,0.28)] [direction:ltr] [text-align:left]",
              isEditing ? "w-full min-w-[12rem]" : "min-w-0 max-w-full"
            )}
            dir="ltr"
          >
            {isEditing ? (
              <EditMessageForm
                key={message.id}
                initialContent={message.content}
                onSave={(content) => onEditSave?.(content)}
                onCancel={() => onEditCancel?.()}
                disabled={actionsDisabled}
              />
            ) : (
              <MarkdownLite content={message.content} inverted />
            )}
          </div>
          {!isEditing ? (
            <MessageActions
              role="user"
              content={message.content}
              isLastUserMessage={isLastUserMessage}
              disabled={actionsDisabled}
              className="self-end"
              onEdit={isLastUserMessage ? onEdit : undefined}
              onRetry={onRetry}
              onDelete={onDelete}
            />
          ) : null}
        </div>
      </div>
    );
  }

  if (isCampaignStudioMessage && campaignDisplay) {
    const caption = stripConversationalFiller(message.content.trim());
    const showCaption =
      caption.length > 0 &&
      !shouldHideCampaignStudioCaption(message.metadata, caption);
    return (
      <div className="studio-chat-embed group ai-msg-in-fade mb-[18px] space-y-2">
        {showCaption ? (
          <div className="flex gap-2.5">
            <AiOrbIcon size="md" className="mt-0.5 shadow-[0_2px_8px_rgba(124,58,237,0.35)]" />
            <p className="max-w-[72%] text-[13px] leading-relaxed text-muted-foreground">
              {caption}
            </p>
          </div>
        ) : null}
        <CampaignStudioHost
          workflowId={campaignDisplay.workflowId}
          workflowName={campaignDisplay.workflowName}
          workflowStatus={campaignDisplay.status}
          currentStep={campaignDisplay.currentStep}
          totalSteps={campaignDisplay.totalSteps}
          progressPercent={
            campaignDisplay.totalSteps
              ? Math.round(
                  (campaignDisplay.completedTasks.length / campaignDisplay.totalSteps) * 100
                )
              : 0
          }
          campaignObject={campaignDisplay.campaignObject}
          summarySections={campaignDisplay.summarySections}
          clarificationQuestion={campaignDisplay.clarificationQuestion}
          completedTasks={campaignDisplay.completedTasks}
          pendingTasks={campaignDisplay.pendingTasks}
          inferredFields={metadata.inferredFields as string[] | undefined}
          actionCards={metadata.actionCards as AiActionCard[] | undefined}
          conversationId={conversationId}
          messageId={message.id}
          scrollContainer={chatScrollContainer}
          onCardUpdated={(cardId, status) =>
            onCardUpdated?.(message.id, cardId, status)
          }
          onVendorDecisionsUpdated={(decisions) =>
            onVendorDecisionsUpdated?.(message.id, decisions)
          }
        />
        <MessageActions
          role="assistant"
          content={message.content}
          disabled={actionsDisabled}
          onRetry={onRetry}
          onDelete={onDelete}
        />
      </div>
    );
  }

  const hasWorkflowPanel = isWorkflowMetadata(message.metadata);
  const hideMarkdown =
    hasWorkflowPanel &&
    shouldHideWorkflowMarkdown(message.metadata, message.metadata.workflowId as string);

  const displayContent = hideMarkdown
    ? ""
    : stripConversationalFiller(message.content.trim());

  return (
    <div className="group ai-msg-in mb-[18px] flex gap-2.5 px-6">
      <AiOrbIcon size="md" className="mt-0.5 shadow-[0_2px_8px_rgba(124,58,237,0.35)]" />
      <div className="flex max-w-[72%] flex-col gap-1">
        <div className="rounded-[4px_12px_12px_12px] border border-border bg-background px-4 py-3.5 text-[13px] leading-relaxed shadow-sm">
          {displayContent ? <MarkdownLite content={displayContent} /> : null}
          {hasWorkflowPanel ? (
            <WorkflowDashboardPanel metadata={toWorkflowDisplayMetadata(message.metadata)} />
          ) : null}
          {message.metadata.actionCards?.length && conversationId ? (
            <ActionCardRenderer
              cards={message.metadata.actionCards}
              conversationId={conversationId}
              messageId={message.id}
              onCardUpdated={(cardId, status) =>
                onCardUpdated?.(message.id, cardId, status)
              }
            />
          ) : null}
        </div>
        <MessageActions
          role="assistant"
          content={message.content}
          disabled={actionsDisabled}
          onRetry={onRetry}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
});

function collapseDuplicateCampaignStudioMessages(messages: AiMessage[]): AiMessage[] {
  const campaignStudioMessageIds = messages
    .filter(
      (message) =>
        message.role === "assistant" &&
        isWorkflowMetadata(message.metadata) &&
        isCampaignWorkflow(message.metadata.workflowId)
    )
    .map((message) => message.id);

  if (campaignStudioMessageIds.length <= 1) {
    return messages;
  }

  const keepId = campaignStudioMessageIds[campaignStudioMessageIds.length - 1]!;
  return messages.filter((message) => {
    if (
      message.role !== "assistant" ||
      !isWorkflowMetadata(message.metadata) ||
      !isCampaignWorkflow(message.metadata.workflowId)
    ) {
      return true;
    }
    return message.id === keepId;
  });
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="ai-t-dot size-[7px] rounded-full bg-violet-500/70" />
      <span className="ai-t-dot size-[7px] rounded-full bg-violet-500/70" />
      <span className="ai-t-dot size-[7px] rounded-full bg-violet-500/70" />
    </div>
  );
}

function WorkflowStreamingIndicator({
  progress,
}: {
  progress: WorkflowStreamState;
}) {
  return (
    <div className="mb-2 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="ai-spinner size-3" />
        <span>
          Step {progress.currentStep}/{progress.totalSteps}: {progress.taskTitle}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="ai-progress-bar h-full rounded-full transition-all duration-300"
          style={{ width: `${progress.progress}%` }}
        />
      </div>
    </div>
  );
}

function MarkdownLite({
  content,
  inverted,
}: {
  content: string;
  inverted?: boolean;
}) {
  const paragraphs = content.split(/\n\n+/);

  return (
    <div
      className={cn(
        "min-w-0 w-full space-y-2 break-words whitespace-pre-wrap text-left [direction:ltr] [text-align:left]",
        inverted && "text-white"
      )}
      dir="ltr"
    >
      {paragraphs.map((paragraph, index) => {
        if (paragraph.startsWith("#### ")) {
          return (
            <h5
              key={index}
              className={cn(
                "text-xs font-semibold",
                inverted ? "text-white/95" : "text-foreground"
              )}
            >
              {paragraph.replace(/^####\s*/, "")}
            </h5>
          );
        }
        if (paragraph.startsWith("### ")) {
          return (
            <h4
              key={index}
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                inverted ? "text-white/90" : "text-muted-foreground"
              )}
            >
              {paragraph.replace(/^###\s*/, "")}
            </h4>
          );
        }
        if (paragraph.startsWith("## ")) {
          return (
            <h3
              key={index}
              className={cn(
                "text-sm font-semibold",
                inverted ? "text-white" : "text-foreground"
              )}
            >
              {paragraph.replace(/^##\s*/, "")}
            </h3>
          );
        }
        if (paragraph.startsWith("- ")) {
          const items = paragraph.split("\n").filter((line) => line.startsWith("- "));
          return (
            <ul key={index} className="list-inside list-disc space-y-0.5">
              {items.map((item, i) => (
                <li key={i}>{item.replace(/^-\s*/, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={index}
            className={cn(
              "w-full text-left [direction:ltr] [text-align:left]",
              inverted && "text-white"
            )}
          >
            {paragraph}
          </p>
        );
      })}
    </div>
  );
}
