"use client";

import { useEffect, useRef, useState } from "react";

import {
  FULL_SIZE_LABEL,
  clientContentAssetUrl,
  clientContentPlaybackMime,
} from "../content-approval";

type PreviewObject = {
  url: string;
  mimeType: string | null;
  fileName: string | null;
};

const PLAYBACK_FAILED =
  "This video could not play in Chrome. Download Original to review it.";

const playableSrcCache = new Map<string, Promise<string>>();

async function loadPreviewObject(
  token: string,
  versionId: string
): Promise<PreviewObject> {
  const response = await fetch(
    clientContentAssetUrl({ token, versionId, mode: "preview", format: "json" })
  );
  const body = (await response.json().catch(() => null)) as
    | { url?: string; mimeType?: string | null; fileName?: string | null; error?: string }
    | null;
  if (!response.ok || !body?.url) {
    throw new Error(body?.error || "This file could not be opened.");
  }
  return {
    url: body.url,
    mimeType: body.mimeType ?? null,
    fileName: body.fileName ?? null,
  };
}

/**
 * Chrome will not play a Storage URL that ends in `.MOV` / is served as
 * `video/quicktime`. Fetch the bytes and expose them as a `blob:` URL typed
 * as MP4 so the player never sees a QuickTime filename.
 */
export async function loadPlayableVideoSrc(token: string, versionId: string): Promise<string> {
  const key = `${token}:${versionId}`;
  const cached = playableSrcCache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    const meta = await loadPreviewObject(token, versionId);
    const playbackType = clientContentPlaybackMime(meta.mimeType, meta.fileName);
    try {
      const response = await fetch(meta.url);
      if (!response.ok) return meta.url;
      const raw = await response.blob();
      const typed = raw.type === playbackType ? raw : new Blob([raw], { type: playbackType });
      return URL.createObjectURL(typed);
    } catch {
      return meta.url;
    }
  })();

  playableSrcCache.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    playableSrcCache.delete(key);
    throw error;
  }
}

export function ClientVideoPreview({
  token,
  versionId,
  title,
}: {
  token: string;
  versionId: string;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setPlaying(false);
    setError(null);
    void loadPlayableVideoSrc(token, versionId)
      .then((next) => {
        if (!cancelled) setSrc(next);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "This video could not be opened.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, versionId]);

  async function play() {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
    } catch {
      setError(PLAYBACK_FAILED);
    }
  }

  return (
    <div className="cx-vid">
      {src ? (
        <video
          ref={videoRef}
          className="camp-content-preview"
          src={src}
          controls={playing}
          playsInline
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            if (videoRef.current?.error?.code === 1) return;
            setError(PLAYBACK_FAILED);
          }}
        />
      ) : (
        <div className="camp-content-preview" aria-hidden="true" />
      )}
      {src && !playing && !error ? (
        <button
          type="button"
          className="cx-vid__play"
          aria-label={`Play ${title}`}
          onClick={() => void play()}
        >
          <span className="cx-vid__play-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      ) : null}
      {!src && !error ? <p className="cx-vid__load">Loading video…</p> : null}
      {error ? <p className="cx-vid__err">{error}</p> : null}
    </div>
  );
}

export function ClientContentFullSizeButton({
  token,
  versionId,
  kind,
  title,
}: {
  token: string;
  versionId: string;
  kind: "video" | "image";
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function openViewer() {
    setError(null);
    setPending(true);
    try {
      if (kind === "image") {
        const meta = await loadPreviewObject(token, versionId);
        setSrc(meta.url);
      } else {
        setSrc(await loadPlayableVideoSrc(token, versionId));
      }
      setOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This file could not be opened.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={pending}
        title={error ?? undefined}
        onClick={() => void openViewer()}
      >
        {pending ? "Opening…" : error ? "Could not open" : FULL_SIZE_LABEL}
      </button>
      {open && src ? (
        <div
          className="cx-lite"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
        >
          <div className="cx-lite__box" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="cx-lite__x" onClick={() => setOpen(false)}>
              Close
            </button>
            {kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={title} />
            ) : (
              <video src={src} controls autoPlay playsInline preload="auto" />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
