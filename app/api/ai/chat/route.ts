import { requirePermission } from "@/lib/auth/permissions-server";
import { captureException } from "@/lib/observability/error-reporter";
import {
  resolveRequestId,
  runWithRequestContext,
} from "@/lib/observability/request-context";
import {
  extractTokenMetrics,
  logWorkflowBoundaryStart,
  recordWorkflowMetrics,
} from "@/lib/observability/workflow-metrics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { parseActionCardsFromResponse } from "@/features/ai-workspace/services/action-card-parser";
import {
  appendMessage,
  createConversation,
  deleteMessagesAfter,
  deriveConversationTitle,
  getConversation,
  updateConversationContextSnapshot,
  updateConversationTitle,
  updateMessageContent,
} from "@/features/ai-workspace/services/conversation-service";
import { getWorkspaceAiOrchestrator } from "@/features/ai-workspace/services/orchestrator-factory";
import {
  chunkTextForStream,
  createSseStream,
} from "@/features/ai-workspace/services/sse-utils";
import { buildWorkspaceContextInput, normalizeWorkspaceContext } from "@/features/ai-workspace/services/workspace-context-service";
import { enrichWorkspaceWithKnowledge } from "@/features/ai-workspace/services/knowledge-context-service";
import { tryExecuteWorkflow, buildPausedWorkflowSnapshot, getPausedWorkflowSnapshot, slimWorkflowMetadataForStream } from "@/features/ai-workspace/services/workflow-adapter";
import type { ChatRequestBody } from "@/features/ai-workspace/types";
import { createStreamingOpenAiProvider } from "@/features/ai-workspace/services/streaming-openai-provider";
import { runWithToolAuthContext } from "@/features/ai/tools/tool-auth";
import {
  attachCampaignObjectToSnapshot,
  loadCampaignObjectForConversation,
  serializeCampaignObject,
} from "@/features/campaign-intelligence";
import { CREATE_CAMPAIGN_WORKFLOW_ID, isCampaignWorkflow } from "@/features/campaign-studio/constants/workflow-ids";
import { runStudioCopilot } from "@/features/campaign-studio/services/copilot/studio-copilot";

/** The user explicitly wants a brand-new campaign — leave Campaign Editing Mode. */
function isNewCampaignRequest(message: string): boolean {
  return /\b(new|another|different|start over|restart|fresh|create a)\b[^.]*\bcampaign\b/i.test(
    message
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = resolveRequestId(request);

  return runWithRequestContext(
    { requestId, service: "ai-chat", workflow: "chat" },
    async () => {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    recordWorkflowMetrics({
      route: "/api/ai/chat",
      startedAt,
      status: "error",
      error: auth.error,
    });
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    recordWorkflowMetrics({
      route: "/api/ai/chat",
      startedAt,
      status: "error",
      userId: auth.userId,
      error: "Invalid JSON body",
    });
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.message?.trim()) {
    recordWorkflowMetrics({
      route: "/api/ai/chat",
      startedAt,
      status: "error",
      userId: auth.userId,
      error: "Message is required",
    });
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role:roles(slug)")
    .eq("id", auth.userId)
    .maybeSingle();

  const profileRow = profile as {
    full_name: string | null;
    role: { slug: string } | null;
  } | null;

  const userContext = {
    id: auth.userId,
    name: profileRow?.full_name ?? undefined,
    role: profileRow?.role?.slug ?? undefined,
  };

  const contextInput = await buildWorkspaceContextInput(
    supabase,
    userContext,
    body.workspace ?? {}
  );

  const aiRequestBase = {
    id: `req_${Date.now()}`,
    message: body.message.trim(),
    intent: body.intent,
    conversationId: undefined as string | undefined,
    context: {
      workspace: normalizeWorkspaceContext(contextInput.workspace),
      user: userContext,
      campaign: contextInput.campaign,
      client: contextInput.client,
      shortlist: contextInput.shortlist,
    },
  };

  try {
    let conversationId = body.conversationId?.trim() || undefined;

    if (conversationId) {
      const existing = await getConversation(supabase, conversationId, auth.userId);
      if (!existing) {
        conversationId = undefined;
      }
    }

    let existingConversation =
      conversationId != null
        ? await getConversation(supabase, conversationId, auth.userId)
        : null;

    if (!conversationId) {
      const created = await createConversation(supabase, auth.userId, {
        title: deriveConversationTitle(body.message),
        workspaceType: contextInput.workspace?.type ?? "general",
        workspaceId: contextInput.workspace?.id,
        contextSnapshot: {
          workspace: normalizeWorkspaceContext(contextInput.workspace),
          campaign: contextInput.campaign,
          client: contextInput.client,
          shortlist: contextInput.shortlist,
        },
      });
      conversationId = created.id;
      existingConversation = created;
    }

    if (!conversationId) {
      throw new Error("Conversation could not be created");
    }

    aiRequestBase.conversationId = conversationId;

    logWorkflowBoundaryStart({
      route: "/api/ai/chat",
      userId: auth.userId,
      conversationId,
      campaignId: contextInput.campaign?.id,
    });

    const enriched = await enrichWorkspaceWithKnowledge(
      supabase,
      aiRequestBase,
      contextInput
    );

    const aiRequest = {
      ...aiRequestBase,
      context: enriched.aiContext,
    };

    const rerunUserMessageId = body.rerunUserMessageId?.trim() || undefined;
    let userMessage: Awaited<ReturnType<typeof appendMessage>>;

    if (rerunUserMessageId) {
      await updateMessageContent(
        supabase,
        rerunUserMessageId,
        conversationId,
        auth.userId,
        body.message.trim()
      );
      await deleteMessagesAfter(supabase, conversationId, auth.userId, rerunUserMessageId);
      userMessage = {
        id: rerunUserMessageId,
        conversationId,
        role: "user",
        content: body.message.trim(),
        metadata: {},
        createdAt: new Date().toISOString(),
      };
    } else {
      userMessage = await appendMessage(supabase, {
        conversationId,
        role: "user",
        content: body.message.trim(),
      });
    }

    const stream = createSseStream(async (send) => {
      await runWithToolAuthContext(
        { supabase, userId: auth.userId },
        async () => {
      try {
        send("start", {
          conversationId,
          userMessageId: userMessage.id,
        });

        const orchestrator = getWorkspaceAiOrchestrator(createStreamingOpenAiProvider());

        const pausedWorkflow = getPausedWorkflowSnapshot(
          existingConversation?.contextSnapshot as Record<string, unknown> | undefined
        );

        // Campaign Editing Mode (highest routing priority): once a studio exists
        // for this conversation, the Campaign Copilot owns every follow-up turn —
        // unless a create-campaign workflow is paused for missing info, or the
        // user explicitly asks to start a new campaign.
        const contextSnapshot = existingConversation?.contextSnapshot as
          | Record<string, unknown>
          | undefined;
        const activeCampaignObject = pausedWorkflow
          ? null
          : await loadCampaignObjectForConversation(supabase, conversationId, contextSnapshot);

        if (activeCampaignObject && !isNewCampaignRequest(body.message)) {
          const copilot = await runStudioCopilot({
            supabase,
            userId: auth.userId,
            conversationId,
            campaignObject: activeCampaignObject,
            message: body.message.trim(),
            focus: body.studioFocus,
          });

          for (const chunk of chunkTextForStream(copilot.reply)) {
            send("delta", { content: chunk });
          }

          const workflowId = isCampaignWorkflow(copilot.campaignObject.workflowId)
            ? copilot.campaignObject.workflowId
            : CREATE_CAMPAIGN_WORKFLOW_ID;

          // Only edits carry the refreshed campaign object (studio re-renders);
          // answers and clarifications stay as plain chat text.
          const assistantMessage = await appendMessage(supabase, {
            conversationId,
            role: "assistant",
            content: copilot.reply,
            metadata: copilot.changed
              ? {
                  agentId: "campaign-copilot",
                  copilotEdit: true,
                  copilotIntent: copilot.intentKind,
                  // workflow:true + a campaign workflowId make this render as a studio.
                  workflow: true,
                  workflowId,
                  workflowName: "Campaign Studio",
                  workflowStatus: "complete",
                  campaignObject: serializeCampaignObject(copilot.campaignObject),
                }
              : { agentId: "campaign-copilot", copilotIntent: copilot.intentKind },
          });

          if (copilot.changed) {
            try {
              await updateConversationContextSnapshot(
                supabase,
                conversationId,
                auth.userId,
                attachCampaignObjectToSnapshot(
                  { ...(contextSnapshot ?? {}) },
                  copilot.campaignObject
                )
              );
            } catch (snapshotError) {
              console.error(
                "[studio-copilot] context snapshot update failed:",
                snapshotError instanceof Error ? snapshotError.message : snapshotError
              );
            }
          }

          send("action_cards", { cards: [], messageId: assistantMessage.id });
          send("done", {
            conversationId,
            messageId: assistantMessage.id,
            agentId: "campaign-copilot",
            workflow: copilot.changed,
          });
          recordWorkflowMetrics({
            route: "/api/ai/chat",
            startedAt,
            status: "success",
            userId: auth.userId,
            conversationId,
            campaignId: contextInput.campaign?.id,
            agentId: "campaign-copilot",
            handled: true,
          });
          return;
        }

        const workflowResult = await tryExecuteWorkflow(
          aiRequest,
          enriched.aiContext,
          {
            orchestrator,
            supabase,
            contextInput: enriched.contextInput,
            conversationId,
            contextSnapshot: existingConversation?.contextSnapshot as
              | Record<string, unknown>
              | undefined,
            pausedWorkflow,
            userId: auth.userId,
            campaignHeaderId: contextInput.campaign?.id ?? null,
            onProgress: (event) => {
              send("workflow_step", event);
              send("workflow_progress", {
                workflowId: event.workflowId,
                step: event.step,
                totalSteps: event.totalSteps,
                progress: event.progress,
                taskId: event.taskId,
                taskTitle: event.taskTitle,
                status: event.status,
              });
            },
          }
        );

        if (workflowResult.handled) {
          const { content, actionCards, metadata, agentId, workflowResult: execution } =
            workflowResult;

          for (const chunk of chunkTextForStream(content)) {
            send("delta", { content: chunk });
          }

          console.log("[workflow-lifecycle] Message persistence started");
          const assistantMessage = await appendMessage(supabase, {
            conversationId,
            role: "assistant",
            content,
            metadata: {
              agentId,
              actionCards,
              ...metadata,
            },
          });
          console.log("[workflow-lifecycle] Message persistence completed");

          const pausedSnapshot = buildPausedWorkflowSnapshot(
            execution,
            pausedWorkflow?.originalUserMessage ?? body.message.trim()
          );
          const baseContextSnapshot = {
            ...(existingConversation?.contextSnapshot ?? {}),
            workspace: normalizeWorkspaceContext(contextInput.workspace),
            campaign: contextInput.campaign,
            client: contextInput.client,
            shortlist: contextInput.shortlist,
            ...(workflowResult.contextSnapshotPatch ?? {}),
          };

          // Auxiliary writes: the assistant message row is already persisted, so a
          // snapshot/title failure must not abort the stream and hide the result.
          try {
            await updateConversationContextSnapshot(
              supabase,
              conversationId,
              auth.userId,
              pausedSnapshot
                ? { ...baseContextSnapshot, pausedWorkflow: pausedSnapshot }
                : baseContextSnapshot
            );

            if (body.message.trim().length > 0) {
              await updateConversationTitle(
                supabase,
                conversationId,
                auth.userId,
                deriveConversationTitle(body.message)
              );
            }
          } catch (auxError) {
            console.error(
              "[workflow-lifecycle] auxiliary conversation update failed:",
              auxError instanceof Error ? auxError.message : auxError
            );
          }

          send("action_cards", { cards: actionCards, messageId: assistantMessage.id });
          console.log('[workflow-lifecycle] SSE "done" started');
          send("done", {
            conversationId,
            messageId: assistantMessage.id,
            agentId,
            workflow: true,
            workflowMetadata: slimWorkflowMetadataForStream(metadata),
          });
          console.log('[workflow-lifecycle] SSE "done" completed');
          recordWorkflowMetrics({
            route: "/api/ai/chat",
            startedAt,
            status: "success",
            userId: auth.userId,
            conversationId,
            campaignId: contextInput.campaign?.id,
            workflowId: metadata?.workflowId as string | undefined,
            agentId,
            handled: true,
            ...extractTokenMetrics(
              metadata as unknown as Record<string, unknown> | undefined
            ),
          });
          return;
        }

        const result = await orchestrator.handle(aiRequest, enriched.contextInput);

        if (!result.success) {
          recordWorkflowMetrics({
            route: "/api/ai/chat",
            startedAt,
            status: "stream_error",
            userId: auth.userId,
            conversationId,
            campaignId: contextInput.campaign?.id,
            agentId: result.error.code,
            handled: false,
            error: result.error.message,
          });
          send("error", { message: result.error.message, code: result.error.code });
          return;
        }

        const content = result.response.content;
        for (const chunk of chunkTextForStream(content)) {
          send("delta", { content: chunk });
        }

        const actionCards = parseActionCardsFromResponse(result.response);

        const assistantMessage = await appendMessage(supabase, {
          conversationId,
          role: "assistant",
          content,
          metadata: {
            agentId: result.response.metadata.agentId,
            toolsUsed: result.response.metadata.toolsUsed,
            actionCards,
            structured: result.response.structured,
            latencyMs: result.response.metadata.latencyMs,
            model: result.response.metadata.model,
          },
        });

        if (body.message.trim().length > 0) {
          await updateConversationTitle(
            supabase,
            conversationId,
            auth.userId,
            deriveConversationTitle(body.message)
          );
        }

        send("action_cards", { cards: actionCards, messageId: assistantMessage.id });
        send("done", {
          conversationId,
          messageId: assistantMessage.id,
          agentId: result.response.metadata.agentId,
        });
        recordWorkflowMetrics({
          route: "/api/ai/chat",
          startedAt,
          status: "success",
          userId: auth.userId,
          conversationId,
          campaignId: contextInput.campaign?.id,
          agentId: result.response.metadata.agentId,
          handled: false,
          ...extractTokenMetrics(
            result.response.metadata as unknown as Record<string, unknown>
          ),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate response";
        recordWorkflowMetrics({
          route: "/api/ai/chat",
          startedAt,
          status: "stream_error",
          userId: auth.userId,
          conversationId,
          campaignId: contextInput.campaign?.id,
          error: message,
        });
        send("error", { message });
      }
        }
      );
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start chat";
    captureException(error, {
      route: "/api/ai/chat",
      service: "ai-chat",
      userId: auth.userId,
      status: 500,
    });
    recordWorkflowMetrics({
      route: "/api/ai/chat",
      startedAt,
      status: "error",
      userId: auth.userId,
      error: message,
    });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
    }
  );
}
