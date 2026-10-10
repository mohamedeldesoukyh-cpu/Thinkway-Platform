"use client";

import { useEffect, useRef, useState } from "react";
import { FULL_SIZE_LABEL, clientContentAssetUrl } from "../content-approval";
import { acquireClientVideoSource } from "../client-video-source";

const PLAYBACK_FAILED = "This video could not play. Download Original to review it.";
type VideoProps = { token: string; versionId: string; title: string };

// Changing the asset or access token releases the previous player and its bytes.
export function ClientVideoPreview(props: VideoProps) {
  return <VideoPreview key={`${props.token}:${props.versionId}`} {...props} />;
}

function VideoPreview({ token, versionId, title }: VideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requested) return;
    const controller = new AbortController();
    let release: (() => void) | undefined;
    setPending(true);
    void acquireClientVideoSource(token, versionId, controller.signal).then(next => {
      release = next.release;
      if (controller.signal.aborted) next.release();
      else { setSrc(next.src); setPending(false); }
    }).catch(caught => {
      if (!controller.signal.aborted) {
        setPending(false);
        setError(caught instanceof Error ? caught.message : "This video could not be opened.");
      }
    });
    return () => { controller.abort(); release?.(); };
  }, [token, versionId, requested]);

  return <div className="cx-vid">
    {src ? <video ref={videoRef} className="camp-content-preview" src={src}
      controls autoPlay playsInline preload="none"
      onError={() => { if (videoRef.current?.error?.code !== 1) setError(PLAYBACK_FAILED); }}
    /> : <div className="camp-content-preview" aria-hidden="true" />}
    {!requested ? <button type="button" className="cx-vid__play" aria-label={`Play ${title}`} onClick={() => setRequested(true)}>
      <span className="cx-vid__play-mark" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
    </button> : null}
    {pending ? <p className="cx-vid__load" role="status">Loading video…</p> : null}
    {error ? <p className="cx-vid__err">{error}</p> : null}
  </div>;
}

type FullSizeProps = VideoProps & { kind: "video" | "image" };
export function ClientContentFullSizeButton(props: FullSizeProps) {
  return <FullSizeButton key={`${props.token}:${props.versionId}:${props.kind}`} {...props} />;
}

function FullSizeButton({ token, versionId, kind, title }: FullSizeProps) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const release = useRef<(() => void) | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => { request.current?.abort(); release.current?.(); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    if (!open) { release.current?.(); release.current = null; setSrc(null); }
  }, [open]);

  async function openViewer() {
    setError(null); setPending(true);
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    try {
      if (kind === "image") {
        const response = await fetch(clientContentAssetUrl({ token, versionId, mode: "preview", format: "json" }), { signal: controller.signal });
        const meta = await response.json().catch(() => null) as { url?: string; error?: string } | null;
        if (!response.ok || !meta?.url) throw new Error(meta?.error || "This file could not be opened.");
        if (controller.signal.aborted) return;
        setSrc(meta.url);
      } else {
        const next = await acquireClientVideoSource(token, versionId, controller.signal);
        if (controller.signal.aborted) { next.release(); return; }
        release.current?.(); release.current = next.release; setSrc(next.src);
      }
      setOpen(true);
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "This file could not be opened.");
    } finally { if (!controller.signal.aborted) setPending(false); }
  }

  return <>
    <button type="button" className="btn" disabled={pending} title={error ?? undefined} onClick={() => void openViewer()}>
      {pending ? "Opening…" : error ? "Could not open" : FULL_SIZE_LABEL}
    </button>
    {open && src ? <div className="cx-lite" role="dialog" aria-modal="true" aria-label={title} onClick={() => setOpen(false)}>
      <div className="cx-lite__box" onClick={event => event.stopPropagation()}>
        <button type="button" className="cx-lite__x" onClick={() => setOpen(false)}>Close</button>
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={title} />
        ) : <video src={src} controls autoPlay playsInline preload="none" />}
      </div>
    </div> : null}
  </>;
}
