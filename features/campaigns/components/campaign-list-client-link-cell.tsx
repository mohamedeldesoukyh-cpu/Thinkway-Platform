"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { revealCampaignClientReviewShareAction } from "@/features/client-workspace/actions/create-from-campaign-action";
import { ClientReviewShareDialog } from "@/features/client-workspace/components/client-review-share-dialog";
import {
  CAMPAIGN_CLIENT_WORKSPACE_LINK_LABEL,
  type CampaignClientWorkspaceLink,
} from "@/features/client-workspace/client-review-selection";
import {
  readClientReviewShare,
  rememberClientReviewShare,
  reviewIdFromShareUrl,
} from "@/features/client-workspace/client-review-share-memory";
import { cn } from "@/lib/utils";

type Props = {
  campaignHeaderId: string;
  link?: CampaignClientWorkspaceLink;
};

export function CampaignListClientLinkCell({ campaignHeaderId, link }: Props) {
  const state = link?.state ?? "none";
  const [pending, startTransition] = useTransition();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareReviewNumber, setShareReviewNumber] = useState<number | undefined>(
    link?.reviewNumber
  );
  const label = CAMPAIGN_CLIENT_WORKSPACE_LINK_LABEL[state];
  const isActive = state === "active";

  function openShare(url: string, reviewNumber: number) {
    setShareUrl(url);
    setShareReviewNumber(reviewNumber);
    setShareOpen(true);
    const reviewId = reviewIdFromShareUrl(url);
    if (reviewId) {
      rememberClientReviewShare(
        { source: "campaign", id: campaignHeaderId },
        { url, reviewNumber, reviewId }
      );
    }
  }

  function onView() {
    startTransition(async () => {
      const cached = readClientReviewShare({ source: "campaign", id: campaignHeaderId });
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
    });
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-0.5 overflow-visible">
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 text-xs leading-snug",
            isActive ? "platform-v6-c-green font-semibold" : "text-muted-foreground"
          )}
          title={
            link?.reviewNumber != null ? `Client Workspace v${link.reviewNumber}` : undefined
          }
        >
          {isActive ? (
            <span className="platform-v6-hs-live-dot shrink-0" aria-hidden />
          ) : null}
          <span className="min-w-0 truncate">{label}</span>
        </span>
        {isActive ? (
          <button
            type="button"
            className="platform-v6-link w-fit text-left text-xs font-semibold"
            disabled={pending}
            aria-label="View Client Workspace link"
            onClick={onView}
          >
            {pending ? (
              <span className="inline-flex items-center gap-1">
                <Loader2Icon className="size-3 animate-spin" />
                Opening
              </span>
            ) : (
              "View"
            )}
          </button>
        ) : null}
      </div>
      <ClientReviewShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        reviewNumber={shareReviewNumber}
      />
    </>
  );
}
