"use client";

import { useState } from "react";
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
  type DeliverableAssetView,
} from "@/lib/services/deliverables/documentation-types";
import { friendlyServerActionError } from "@/lib/clients/client-document-utils";

type PreviewState = {
  url: string;
  kind: "video" | "image" | "pdf";
  title: string;
};

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
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const version = asset.currentVersion;
  const kind = deliverableAssetPreviewKind(version?.mimeType, version?.fileName);
  const canViewFile = Boolean(version?.storagePath);
  const externalUrl = version?.externalUrl?.trim() || null;

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
        setPreview({
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

  return (
    <>
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
            {opening ? "Opening…" : "View"}
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
      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.title ?? "Uploaded content"}</DialogTitle>
            <DialogDescription>Client-review file for this deliverable.</DialogDescription>
          </DialogHeader>
          {preview?.kind === "video" ? (
            <video
              src={preview.url}
              controls
              playsInline
              className="max-h-[70vh] w-full rounded-md bg-black"
            />
          ) : null}
          {preview?.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={preview.title}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          ) : null}
          {preview?.kind === "pdf" ? (
            <iframe
              title={preview.title}
              src={preview.url}
              className="h-[70vh] w-full rounded-md border"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
