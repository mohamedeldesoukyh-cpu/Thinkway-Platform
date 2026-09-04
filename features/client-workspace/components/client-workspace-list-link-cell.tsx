"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ClientReviewShareDialog } from "@/features/client-workspace/components/client-review-share-dialog";
import {
  type ClientWorkspaceListLink,
  type ClientWorkspaceListLinkSource,
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
  source: ClientWorkspaceListLinkSource;
  id: string;
  link?: ClientWorkspaceListLink;
};

type ClientLinkApiSuccess = {
  ok: true;
  url?: string;
  reviewNumber?: number;
  created?: boolean;
  stopped?: boolean;
  message?: string;
};

type ClientLinkApiFailure = {
  ok: false;
  message: string;
  blockers?: string[];
};

async function postClientWorkspaceListLink(
  source: ClientWorkspaceListLinkSource,
  id: string,
  op: "activate" | "stop" | "reveal"
): Promise<ClientLinkApiSuccess | ClientLinkApiFailure> {
  const response = await fetch("/api/client-workspace/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, id, op }),
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    url?: string;
    reviewNumber?: number;
    created?: boolean;
    stopped?: boolean;
    message?: string;
    blockers?: string[];
    error?: string;
  } | null;

  if (payload?.ok === true) {
    return {
      ok: true,
      url: payload.url,
      reviewNumber: payload.reviewNumber,
      created: payload.created,
      stopped: payload.stopped,
      message: payload.message,
    };
  }

  const raw = payload?.message ?? payload?.error ?? "";
  return {
    ok: false,
    message: clientLinkErrorMessage(raw, "Could not update the Client Workspace link."),
    blockers: payload?.blockers,
  };
}

function clientLinkErrorMessage(message: string, fallback: string): string {
  if (/Server Components render|digest property is included/i.test(message)) {
    return "Could not update the Client Workspace link. Refresh and try again.";
  }
  return message.trim() || fallback;
}

export function ClientWorkspaceListLinkCell({ source, id, link }: Props) {
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<CampaignClientWorkspaceLinkState>(link?.state ?? "none");
  const [reviewNumber, setReviewNumber] = useState<number | undefined>(link?.reviewNumber);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const shareScope = { source, id };
  const isActive = state === "active";
  const isNone = state === "none";
  const statusLabel =
    state === "active"
      ? "Client link active"
      : state === "off"
        ? "Client link revoked"
        : "Client link not set up";
  const documentLabel =
    source === "quotation" ? "Quotation" : source === "shortlist" ? "Shortlist" : "Campaign";

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
      const result = await postClientWorkspaceListLink(source, id, "activate");
      if (!result.ok) {
        toast.error(result.message, {
          description: result.blockers?.slice(0, 4).join(" "),
        });
        return;
      }
      if (!result.url || result.reviewNumber == null) {
        toast.error("Could not activate the Client Workspace link.");
        return;
      }
      setState("active");
      openShare(result.url, result.reviewNumber);
      if (result.message) toast.success(result.message);
    } catch (error) {
      toast.error(
        clientLinkErrorMessage(
          error instanceof Error ? error.message : "",
          "Could not activate the Client Workspace link."
        )
      );
    } finally {
      setPending(false);
    }
  }

  async function stopLink() {
    if (pending) return;
    setPending(true);
    try {
      const result = await postClientWorkspaceListLink(source, id, "stop");
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      forgetClientReviewShare(shareScope);
      setShareOpen(false);
      setShareUrl(null);
      setState("off");
      toast.success(result.message ?? "Client Workspace link stopped.");
    } catch (error) {
      toast.error(
        clientLinkErrorMessage(
          error instanceof Error ? error.message : "",
          "Could not stop the Client Workspace link."
        )
      );
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

  return (
    <>
      <span className="tw-lnk">
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          aria-busy={pending || undefined}
          aria-label="Client link"
          disabled={pending}
          className={cn("tw-sw", isActive && "on")}
          onClick={() => void onToggle(!isActive)}
        />
        <span
          className={cn("tw-live", isActive && "on", isNone && "none")}
          role="status"
          aria-label={statusLabel}
          title={statusLabel}
        />
      </span>
      <ClientReviewShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        reviewNumber={reviewNumber}
        status={state}
        version={reviewNumber != null ? `v${reviewNumber}` : null}
        documentLabel={documentLabel}
        linkEnabled={isActive}
      />
    </>
  );
}
