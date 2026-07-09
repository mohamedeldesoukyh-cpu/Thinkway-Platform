import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { IntelligenceWorkspace } from "@/features/ai-workspace/components/intelligence-workspace";
import { AI_WORKSPACE_COPY } from "@/features/ai-workspace/constants/ai-copy";
import {
  buildWorkspaceContextInput,
  normalizeWorkspaceContext,
  parseWorkspaceParams,
  workspaceLabelFromContext,
} from "@/features/ai-workspace/services/workspace-context-service";
import { getAuthUser } from "@/lib/supabase/server";

type ConversationPageProps = {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AiConversationPage({
  params,
  searchParams,
}: ConversationPageProps) {
  const { conversationId } = await params;
  const urlParams = parseWorkspaceParams(await searchParams);
  const { user } = await getAuthUser();

  let workspaceLabel: string | undefined;
  if (user && (urlParams.workspace || urlParams.id)) {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const contextInput = await buildWorkspaceContextInput(
      supabase,
      { id: user.id },
      urlParams
    );
    workspaceLabel = workspaceLabelFromContext({
      workspace: normalizeWorkspaceContext(contextInput.workspace),
      campaign: contextInput.campaign,
      client: contextInput.client,
      shortlist: contextInput.shortlist,
    });
  }

  return (
    <DashboardShell
      title={AI_WORKSPACE_COPY.title}
      description={AI_WORKSPACE_COPY.subtitle}
      hidePageHeader
      containedMain
      mainClassName="p-0 md:p-0"
    >
      <PlatformErrorBoundary surface="analytics">
        <IntelligenceWorkspace
          initialConversationId={conversationId}
          workspaceParams={urlParams}
          workspaceLabel={workspaceLabel}
        />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
