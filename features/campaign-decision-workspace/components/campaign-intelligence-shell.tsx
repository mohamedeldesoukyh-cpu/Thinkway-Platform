"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignStudioHost } from "@/features/campaign-decision-workspace/components/campaign-studio-host";
import type { CampaignObject } from "@/features/campaign-intelligence";

type CampaignIntelligenceShellProps = {
  conversationId: string;
};

/** Internal dev route shell — no user-facing nav links to this route. */
export function CampaignIntelligenceShell({ conversationId }: CampaignIntelligenceShellProps) {
  const [campaignObject, setCampaignObject] = useState<CampaignObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai/conversations/${conversationId}`);
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to load conversation");
      }
      const data = (await response.json()) as {
        conversation?: {
          campaignObject?: CampaignObject;
          contextSnapshot?: Record<string, unknown>;
        };
      };
      const object =
        data.conversation?.campaignObject ??
        (data.conversation?.contextSnapshot?.campaignObject as CampaignObject | undefined) ??
        null;
      if (!object) {
        throw new Error("No CampaignObject found for this conversation");
      }
      setCampaignObject(object);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="min-h-[400px] flex-1 rounded-2xl" />
      </div>
    );
  }

  if (error || !campaignObject) {
    return (
      <div className="flex min-h-[40vh] flex-col items-start gap-4 p-6">
        <p className="text-sm text-destructive">{error ?? "Campaign not available"}</p>
        <Button variant="outline" asChild>
          <Link href={`/ai/${conversationId}`}>
            <ArrowLeftIcon className="mr-1.5 size-4" />
            Back to AI Workspace
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="h-8">
            <Link href={`/ai/${conversationId}`}>
              <ArrowLeftIcon className="mr-1 size-3.5" />
              AI Workspace
            </Link>
          </Button>
          <div>
            <h1 className="text-sm font-semibold">Campaign Intelligence (Dev)</h1>
            <p className="text-[11px] text-muted-foreground">
              Internal route · F1 One Workspace host
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <PlatformErrorBoundary surface="analytics">
          <CampaignStudioHost
            campaignObject={campaignObject}
            workflowId={campaignObject.workflowId}
            workflowStatus="complete"
            conversationId={conversationId}
            onCampaignObjectPromoted={setCampaignObject}
          />
        </PlatformErrorBoundary>
      </div>
    </div>
  );
}
