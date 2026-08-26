"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2Icon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ensureCampaignClientReviewLinkAction,
  peekCampaignClientReviewShareAction,
} from "@/features/client-workspace/actions/create-from-campaign-action";
import { ClientReviewShareDialog } from "@/features/client-workspace/components/client-review-share-dialog";
import {
  readClientReviewShare,
  rememberClientReviewShare,
  reviewIdFromShareUrl,
} from "@/features/client-workspace/client-review-share-memory";
import { clientReviewShareHasLink } from "@/features/client-workspace/client-review-selection";

type Props = {
  campaignHeaderId: string;
};

export function CampaignClientReviewLinkButton({ campaignHeaderId }: Props) {
  const [pending, startTransition] = useTransition();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareReviewNumber, setShareReviewNumber] = useState<number | undefined>(undefined);
  const shareScope = { source: "campaign" as const, id: campaignHeaderId };
  const [hasLink, setHasLink] = useState(() => Boolean(readClientReviewShare(shareScope)));

  useEffect(() => {
    const scope = { source: "campaign" as const, id: campaignHeaderId };
    setHasLink(Boolean(readClientReviewShare(scope)));
    void peekCampaignClientReviewShareAction({ campaignHeaderId }).then((result) => {
      setHasLink(clientReviewShareHasLink(result.exists, Boolean(readClientReviewShare(scope))));
      if (result.reviewNumber != null) setShareReviewNumber(result.reviewNumber);
    });
  }, [campaignHeaderId]);

  function rememberShare(url: string, reviewNumber: number) {
    setShareUrl(url);
    setShareReviewNumber(reviewNumber);
    setHasLink(true);
    const reviewId = reviewIdFromShareUrl(url);
    if (reviewId) rememberClientReviewShare(shareScope, { url, reviewNumber, reviewId });
  }

  function runLinkButton() {
    startTransition(async () => {
      const cached = readClientReviewShare(shareScope);
      if (cached) {
        setShareUrl(cached.url);
        setShareReviewNumber(cached.reviewNumber);
        setHasLink(true);
        setShareOpen(true);
        return;
      }
      const result = await ensureCampaignClientReviewLinkAction({ campaignHeaderId });
      if (!result.ok) {
        toast.error(result.message, {
          description: result.blockers.slice(0, 4).join(" "),
        });
        return;
      }
      rememberShare(result.url, result.reviewNumber);
      setShareOpen(true);
      if (result.created) toast.success(result.message);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="thinkway-campaign-btn"
        disabled={pending}
        onClick={runLinkButton}
      >
        {pending ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <Link2Icon className="size-3.5" />
        )}
        {hasLink ? "Show link" : "Generate link"}
      </Button>
      <ClientReviewShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        reviewNumber={shareReviewNumber}
      />
    </>
  );
}
