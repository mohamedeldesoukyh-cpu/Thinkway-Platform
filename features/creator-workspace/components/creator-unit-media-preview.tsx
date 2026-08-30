"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadCreatorUnitAssetAction } from "@/features/creator-workspace/actions";
import {
  deliverableAssetPreviewKind,
} from "@/lib/services/deliverables/documentation-types";
import { deliverablePlaybackMime } from "@/lib/services/deliverables/playback-mime";

function formatBytes(size: number | null | undefined): string | null {
  if (size == null || !Number.isFinite(size) || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSubmittedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function CreatorUnitMediaPreview({
  campaignHeaderId,
  assignmentDeliverableId,
  assignmentPostScheduleId,
  versionId,
  fileName,
  mimeType,
  fileSize,
  versionNumber,
  uploadedAt,
}: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  versionId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  versionNumber: number | null;
  uploadedAt: string | null;
}) {
  const kind = deliverableAssetPreviewKind(mimeType, fileName);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullOpen, setFullOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setSrc(null);
    setError(null);

    void (async () => {
      const result = await downloadCreatorUnitAssetAction({
        campaignHeaderId,
        assignmentDeliverableId,
        assignmentPostScheduleId,
        versionId,
      });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const signedUrl = result.data.url;
      if (kind === "video") {
        const playbackType = deliverablePlaybackMime(mimeType, fileName);
        try {
          const response = await fetch(signedUrl);
          if (response.ok) {
            const raw = await response.blob();
            const typed = raw.type === playbackType ? raw : new Blob([raw], { type: playbackType });
            objectUrl = URL.createObjectURL(typed);
            setSrc(objectUrl);
            return;
          }
        } catch {
          /* signed URL in the player is enough when CORS blocks the blob fetch */
        }
      }
      setSrc(signedUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    campaignHeaderId,
    assignmentDeliverableId,
    assignmentPostScheduleId,
    versionId,
    fileName,
    mimeType,
    kind,
  ]);

  const meta = [
    versionNumber ? `Version ${versionNumber}` : null,
    fileName,
    formatBytes(fileSize),
    formatSubmittedAt(uploadedAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : !src ? (
        <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />
      ) : kind === "video" ? (
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-xl bg-black"
        />
      ) : kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={fileName ?? "Submitted image"}
          className="max-h-[28rem] w-full rounded-xl object-contain bg-muted"
        />
      ) : kind === "pdf" ? (
        <iframe title={fileName ?? "PDF"} src={src} className="h-72 w-full rounded-xl border" />
      ) : (
        <div className="rounded-xl border border-border p-3 text-sm">
          <p className="font-medium">{fileName ?? "Submitted file"}</p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open file
          </a>
        </div>
      )}
      {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
      {src && (kind === "video" || kind === "image") ? (
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setFullOpen(true)}>
          Full size
        </Button>
      ) : null}
      <Dialog open={fullOpen} onOpenChange={setFullOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{fileName ?? "Submitted file"}</DialogTitle>
            <DialogDescription>{meta}</DialogDescription>
          </DialogHeader>
          {src && kind === "video" ? (
            <video src={src} controls playsInline className="max-h-[80vh] w-full rounded-md bg-black" />
          ) : null}
          {src && kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={fileName ?? "Submitted image"} className="max-h-[80vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
      {src && kind !== "video" && kind !== "image" ? null : src ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => {
            window.open(src, "_blank", "noopener,noreferrer");
          }}
        >
          Download original
        </Button>
      ) : null}
    </div>
  );
}
