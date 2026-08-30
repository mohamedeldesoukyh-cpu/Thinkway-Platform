"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { PlatformV6Toggle } from "@/components/platform/platform-v6-layout";
import {
  ensureCampaignClientReviewLinkAction,
  revealCampaignClientReviewShareAction,
  stopCampaignClientReviewShareAction,
} from "@/features/client-workspace/actions/create-from-campaign-action";
import { ClientReviewShareDialog } from "@/features/client-workspace/components/client-review-share-dialog";
import {
  CAMPAIGN_CLIENT_WORKSPACE_LINK_LABEL,
  type CampaignClientWorkspaceLink,
  type CampaignClientWorkspaceLinkState,
} from "@/features/client-workspace/client-review-selection";
import {
  forgetClientReviewShare,
  readClientReviewShare,
  rememberClientReviewShare,
  reviewIdFromShareUrl,
} from "@/features/client-workspace/client-review-share-memory";
import { cn } from "@/lib/utils";

type Props = {
  campaignHeaderId: string;
  link?: CampaignClientWorkspaceLink;
};

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function CampaignListClientLinkCell({ campaignHeaderId, link }: Props) {
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<CampaignClientWorkspaceLinkState>(link?.state ?? "none");
  const [reviewNumber, setReviewNumber] = useState<number | undefined>(link?.reviewNumber);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const shareScope = { source: "campaign" as const, id: campaignHeaderId };
  const label = CAMPAIGN_CLIENT_WORKSPACE_LINK_LABEL[state];
  const isActive = state === "active";

  useEffect(() => {
    setState(link?.state ?? "none");
    setReviewNumber(link?.reviewNumber);
  }, [link?.state, link?.reviewNumber]);

  function openShare(url: string, nextReviewNumber: number) {
    setShareUrl(url);
    setReviewNumber(nextReviewNumber);
    setShareOpen(true);
    const reviewId = reviewIdFromShareUrl(url);
    if (reviewId) {
      rememberClientReviewShare(shareScope, {
        url,
        reviewNumber: nextReviewNumber,
        reviewId,
      });
    }
  }

  async function activateLink() {
    if (pending) return;
    setPending(true);
    try {
      const result = await ensureCampaignClientReviewLinkAction({ campaignHeaderId });
      if (!result.ok) {
        toast.error(result.message, {
          description: result.blockers.slice(0, 4).join(" "),
        });
        return;
      }
      setState("active");
      openShare(result.url, result.reviewNumber);
      if (result.created) toast.success(result.message);
    } catch (error) {
      toast.error(actionErrorMessage(error, "Could not activate the Client Workspace link."));
    } finally {
      setPending(false);
    }
  }

  async function stopLink() {
    if (pending) return;
    setPending(true);
    try {
      const result = await stopCampaignClientReviewShareAction({ campaignHeaderId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      forgetClientReviewShare(shareScope);
      setShareOpen(false);
      setShareUrl(null);
      setState("off");
      toast.success(result.message);
    } catch (error) {
      toast.error(actionErrorMessage(error, "Could not stop the Client Workspace link."));
    } finally {
      setPending(false);
    }
  }

  function onToggle(next: boolean) {
    if (next) {
      if (!isActive) void activateLink();
      return;
    }
    if (isActive) void stopLink();
  }

  async function onView() {
    if (pending) return;
    setPending(true);
    try {
      const cached = readClientReviewShare(shareScope);
      if (cached) {
        openShare(cached.url, cached.reviewNumber);
        return;
      }
      const result = await revealCampaignClientReviewShareAction({ campaignHeaderId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      openShare(result.url, result.reviewNumber);
    } catch (error) {
      toast.error(actionErrorMessage(error, "Could not open the Client Workspace link."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-1 overflow-visible whitespace-normal">
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 text-xs leading-snug",
            isActive ? "platform-v6-c-green font-semibold" : "text-muted-foreground"
          )}
          title={reviewNumber != null ? `Client Workspace v${reviewNumber}` : undefined}
        >
          {isActive ? (
            <span className="platform-v6-hs-live-dot shrink-0" aria-hidden />
          ) : null}
          <span className="min-w-0 break-words">{label}</span>
          {pending ? <Loader2Icon className="size-3 shrink-0 animate-spin" /> : null}
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <PlatformV6Toggle
            checked={isActive}
            disabled={pending}
            aria-label="Client Workspace link active"
            onCheckedChange={onToggle}
          />
          <button
            type="button"
            className={cn(
              "text-xs font-semibold leading-none",
              isActive ? "platform-v6-c-red" : "text-muted-foreground"
            )}
            disabled={pending || !isActive}
            aria-label="Stop Client Workspace link"
            onClick={() => void stopLink()}
          >
            Stop
          </button>
        </div>
        {isActive ? (
          <button
            type="button"
            className="platform-v6-link w-fit text-left text-xs font-semibold"
            disabled={pending}
            aria-label="View Client Workspace link"
            onClick={() => void onView()}
          >
            View
          </button>
        ) : null}
      </div>
      <ClientReviewShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        reviewNumber={reviewNumber}
      />
    </>
  );
}
