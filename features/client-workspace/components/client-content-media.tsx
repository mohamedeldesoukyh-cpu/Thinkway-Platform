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
  const [object, setObject] = useState<PreviewObject | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPreviewObject(token, versionId)
      .then((next) => {
        if (!cancelled) setObject(next);
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

  useEffect(() => {
    if (!object) return;
    videoRef.current?.load();
  }, [object]);

  async function play() {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
    } catch {
      setError("This video could not play here. Open Full size or download the original.");
    }
  }

  const playbackType = object
    ? clientContentPlaybackMime(object.mimeType, object.fileName)
    : "video/mp4";

  return (
    <div className="cx-vid">
      {object ? (
        <video
          ref={videoRef}
          className="camp-content-preview"
          controls={playing}
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() =>
            setError("This video could not play here. Open Full size or download the original.")
          }
        >
          <source src={object.url} type={playbackType} />
        </video>
      ) : (
        <div className="camp-content-preview" aria-hidden="true" />
      )}
      {playing || error ? null : (
        <button
          type="button"
          className="cx-vid__play"
          aria-label={`Play ${title}`}
          disabled={!object}
          onClick={() => void play()}
        >
          <span className="cx-vid__play-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
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
  const [object, setObject] = useState<PreviewObject | null>(null);
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
      const next = object ?? (await loadPreviewObject(token, versionId));
      setObject(next);
      setOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This file could not be opened.");
    } finally {
      setPending(false);
    }
  }

  const playbackType = object
    ? clientContentPlaybackMime(object.mimeType, object.fileName)
    : "video/mp4";

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
      {open && object ? (
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
              <img src={object.url} alt={title} />
            ) : (
              <video controls autoPlay playsInline preload="auto">
                <source src={object.url} type={playbackType} />
              </video>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
