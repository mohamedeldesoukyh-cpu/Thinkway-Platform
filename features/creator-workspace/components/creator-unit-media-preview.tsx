"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadCreatorUnitAssetAction } from "@/features/creator-workspace/actions";
import { deliverableAssetPreviewKind } from "@/lib/services/deliverables/documentation-types";
import { deliverablePlaybackMime } from "@/lib/services/deliverables/playback-mime";

const LARGE_BLOB_FALLBACK_BYTES = 40 * 1024 * 1024;
const PLAYBACK_FAILED =
  "This video could not play in the browser. Download the original to review it.";

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

async function playableBlobUrl(
  signedUrl: string,
  playbackType: string
): Promise<string | null> {
  try {
    const response = await fetch(signedUrl);
    if (!response.ok) return null;
    const raw = await response.blob();
    const typed = raw.type === playbackType ? raw : new Blob([raw], { type: playbackType });
    return URL.createObjectURL(typed);
  } catch {
    return null;
  }
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
  variant = "default",
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
  variant?: "default" | "workspace";
}) {
  const kind = deliverableAssetPreviewKind(mimeType, fileName);
  const playbackType = deliverablePlaybackMime(mimeType, fileName);
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const blobTriedRef = useRef(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullOpen, setFullOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(null);
    blobTriedRef.current = false;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

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
      setSrc(result.data.url);
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
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

  async function retryAsTypedBlob() {
    if (!src || blobTriedRef.current) return;
    blobTriedRef.current = true;
    if (fileSize != null && fileSize > LARGE_BLOB_FALLBACK_BYTES) {
      setError(PLAYBACK_FAILED);
      return;
    }
    const typed = await playableBlobUrl(src, playbackType);
    if (!typed) {
      setError(PLAYBACK_FAILED);
      return;
    }
    blobUrlRef.current = typed;
    setError(null);
    setSrc(typed);
  }

  const meta = [
    versionNumber ? `Version ${versionNumber}` : null,
    fileName,
    formatBytes(fileSize),
    formatSubmittedAt(uploadedAt),
  ]
    .filter(Boolean)
    .join(" · ");

  const workspace = variant === "workspace";
  const player =
    error && !src ? (
      <div className="wk__ph">
        <span>{error}</span>
      </div>
    ) : !src ? (
      <div className="wk__ph">
        <span>Loading preview…</span>
      </div>
    ) : kind === "video" ? (
      <video
        key={src}
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        onError={() => {
          if (videoRef.current?.error?.code === 1) return;
          if (blobTriedRef.current) {
            setError(PLAYBACK_FAILED);
            return;
          }
          void retryAsTypedBlob();
        }}
      >
        <source src={src} type={playbackType} />
      </video>
    ) : kind === "image" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={fileName ?? "Submitted image"} />
    ) : (
      <div className="wk__ph">
        <span>{fileName ?? "Submitted file"}</span>
      </div>
    );

  if (workspace) {
    return (
      <>
        <div className="wk__media">{player}</div>
        {src ? (
          <div className="wk__mact">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
            >
              Download
            </button>
            {kind === "video" || kind === "image" ? (
              <button type="button" className="btn btn-sm" onClick={() => setFullOpen(true)}>
                Full size
              </button>
            ) : null}
          </div>
        ) : null}
        <Dialog open={fullOpen} onOpenChange={setFullOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{fileName ?? "Submitted file"}</DialogTitle>
              <DialogDescription>{meta}</DialogDescription>
            </DialogHeader>
            {src && kind === "video" ? (
              <video key={src} src={src} controls playsInline className="max-h-[80vh] w-full rounded-md bg-black">
                <source src={src} type={playbackType} />
              </video>
            ) : null}
            {src && kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={fileName ?? "Submitted image"} className="max-h-[80vh] w-full object-contain" />
            ) : null}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-2">
      {error && !src ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : !src ? (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-border bg-muted/40">
          <p className="text-sm text-muted-foreground">Loading preview…</p>
        </div>
      ) : kind === "video" ? (
        <div className="space-y-1">
          <video
            key={src}
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-lg bg-black"
            onError={() => {
              if (videoRef.current?.error?.code === 1) return;
              if (blobTriedRef.current) {
                setError(PLAYBACK_FAILED);
                return;
              }
              void retryAsTypedBlob();
            }}
          >
            <source src={src} type={playbackType} />
          </video>
          {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
        </div>
      ) : kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={fileName ?? "Submitted image"}
          className="max-h-[28rem] w-full rounded-lg bg-muted object-contain"
        />
      ) : kind === "pdf" ? (
        <iframe title={fileName ?? "PDF"} src={src} className="h-72 w-full rounded-lg border" />
      ) : (
        <div className="rounded-lg border border-border p-3 text-sm">
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
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Current version</dt>
          <dd className="font-medium">{versionNumber ? `Version ${versionNumber}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">File name</dt>
          <dd className="truncate font-medium">{fileName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">File size</dt>
          <dd className="font-medium">{formatBytes(fileSize) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Submitted</dt>
          <dd className="font-medium">{formatSubmittedAt(uploadedAt) ?? "—"}</dd>
        </div>
      </dl>
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
            <video key={src} src={src} controls playsInline className="max-h-[80vh] w-full rounded-md bg-black">
              <source src={src} type={playbackType} />
            </video>
          ) : null}
          {src && kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={fileName ?? "Submitted image"} className="max-h-[80vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
      {src ? (
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
