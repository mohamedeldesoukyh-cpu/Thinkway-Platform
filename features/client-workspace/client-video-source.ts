import { clientContentAssetUrl, clientContentPlaybackMime } from "./content-approval";

/** Acquire only after a viewer asks to play. The caller owns and releases blobs. */
export async function acquireClientVideoSource(token: string, versionId: string, signal: AbortSignal) {
  const response = await fetch(clientContentAssetUrl({ token, versionId, mode: "preview", format: "json" }), { signal });
  const meta = await response.json().catch(() => null) as { url?: string; mimeType?: string; fileName?: string; error?: string } | null;
  if (!response.ok || !meta?.url) throw new Error(meta?.error || "This file could not be opened.");
  // Normal MP4/WebM files can stream and seek using the storage server's range
  // support. Only retain the existing QuickTime compatibility workaround for MOV.
  const quickTime = meta.mimeType?.toLowerCase().includes("quicktime") || /\.mov$/i.test(meta.fileName ?? "");
  if (!quickTime) return { src: meta.url, release() {} };
  try {
    const media = await fetch(meta.url, { signal });
    if (!media.ok) return { src: meta.url, release() {} };
    const raw = await media.blob();
    signal.throwIfAborted();
    const mime = clientContentPlaybackMime(meta.mimeType, meta.fileName);
    const src = URL.createObjectURL(raw.type === mime ? raw : new Blob([raw], { type: mime }));
    let released = false;
    return { src, release() { if (!released) { released = true; URL.revokeObjectURL(src); } } };
  } catch (error) {
    if (signal.aborted) throw error;
    return { src: meta.url, release() {} };
  }
}
