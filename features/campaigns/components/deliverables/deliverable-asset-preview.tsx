"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon, EyeIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDeliverableAssetDownloadUrlAction } from "@/features/campaigns/actions/deliverable-documentation-actions";
import {
  deliverableAssetPreviewKind,
  googleDriveFilePreviewUrl,
  versionCountsAsClientContent,
  type DeliverableAssetView,
} from "@/lib/services/deliverables/documentation-types";
import { friendlyServerActionError } from "@/lib/clients/client-document-utils";

type PreviewState = {
  url: string;
  kind: "video" | "image" | "pdf";
  title: string;
};

function AssetMedia({
  kind,
  url,
  title,
  className,
}: {
  kind: "video" | "image" | "pdf";
  url: string;
  title: string;
  className?: string;
}) {
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={className ?? "max-h-[70vh] w-full rounded-md bg-black"}
      />
    );
  }
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={title}
        className={className ?? "max-h-[70vh] w-full rounded-md object-contain"}
      />
    );
  }
  return (
    <iframe
      title={title}
      src={url}
      className={className ?? "h-[70vh] w-full rounded-md border"}
    />
  );
}

export function DeliverableAssetPreview({
  campaignHeaderId,
  assignmentDeliverableId,
  assignmentPostScheduleId,
  asset,
  disabled,
}: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  asset: DeliverableAssetView;
  disabled?: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const [dialog, setDialog] = useState<PreviewState | null>(null);
  const [inline, setInline] = useState<PreviewState | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const version = asset.currentVersion;
  const kind = deliverableAssetPreviewKind(version?.mimeType, version?.fileName);
  const canViewFile = Boolean(version?.storagePath);
  const playable = versionCountsAsClientContent(version);
  const externalUrl = version?.externalUrl?.trim() || null;
  const drivePreview = googleDriveFilePreviewUrl(externalUrl);

  useEffect(() => {
    if (!canViewFile || !kind || !version) {
      setInline(null);
      setInlineError(null);
      return;
    }
    let cancelled = false;
    setOpening(true);
    setInlineError(null);
    void getDeliverableAssetDownloadUrlAction({
      campaignHeaderId,
      assignmentDeliverableId,
      assignmentPostScheduleId,
      versionId: version.id,
    })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setInlineError(res.message);
          return;
        }
        setInline({
          url: res.data.url,
          kind,
          title: version.fileName || asset.label || "Uploaded content",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setInlineError(friendlyServerActionError(error));
      })
      .finally(() => {
        if (!cancelled) setOpening(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    asset.label,
    assignmentDeliverableId,
    assignmentPostScheduleId,
    campaignHeaderId,
    canViewFile,
    kind,
    version?.fileName,
    version?.id,
  ]);

  async function openSigned(mode: "view" | "download") {
    if (!version) return;
    setOpening(true);
    try {
      const res = await getDeliverableAssetDownloadUrlAction({
        campaignHeaderId,
        assignmentDeliverableId,
        assignmentPostScheduleId,
        versionId: version.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (mode === "view" && kind) {
        setDialog({
          url: res.data.url,
          kind,
          title: version.fileName || asset.label || "Uploaded content",
        });
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(friendlyServerActionError(error));
    } finally {
      setOpening(false);
    }
  }

  if (!playable) {
    return (
      <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
        This upload did not finish. Choose the file again so it can play here and in
        Client Workspace.
      </p>
    );
  }

  return (
    <>
      {inline ? (
        <div className="mt-2 overflow-hidden rounded-md border bg-black/80">
          <AssetMedia
            kind={inline.kind}
            url={inline.url}
            title={inline.title}
            className={
              inline.kind === "pdf"
                ? "h-[360px] w-full bg-white"
                : "max-h-[360px] w-full bg-black"
            }
          />
        </div>
      ) : null}
      {drivePreview ? (
        <iframe
          title={version?.fileName || asset.label || "Google Drive file"}
          src={drivePreview}
          className="mt-2 h-[360px] w-full rounded-md border"
          allow="autoplay"
        />
      ) : null}
      {opening && canViewFile && !inline ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Loading player…</p>
      ) : null}
      {inlineError ? (
        <p className="mt-2 text-[11px] text-destructive">{inlineError}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {canViewFile && kind ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            disabled={disabled || opening}
            onClick={() => void openSigned("view")}
          >
            <EyeIcon className="size-3.5" />
            {opening ? "Opening…" : "View full size"}
          </Button>
        ) : null}
        {canViewFile ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            disabled={disabled || opening}
            onClick={() => void openSigned("download")}
          >
            {kind ? "Open file" : "Download"}
          </Button>
        ) : null}
        {externalUrl ? (
          <Button type="button" size="sm" variant="outline" className="h-7" asChild>
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="size-3.5" />
              Open link
            </a>
          </Button>
        ) : null}
      </div>
      <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{dialog?.title ?? "Uploaded content"}</DialogTitle>
            <DialogDescription>Client-review file for this deliverable.</DialogDescription>
          </DialogHeader>
          {dialog ? (
            <AssetMedia kind={dialog.kind} url={dialog.url} title={dialog.title} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
