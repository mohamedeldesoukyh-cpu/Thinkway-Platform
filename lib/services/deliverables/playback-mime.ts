/**
 * Chrome cannot play `video/quicktime`. Instagram/iPhone stories named .MOV are often MP4.
 * Shared by Client Workspace and Creator Workspace — do not fork.
 */
export function deliverablePlaybackMime(
  mimeType: string | null | undefined,
  fileName: string | null | undefined
): string {
  const mime = mimeType?.trim().toLowerCase() ?? "";
  const name = fileName?.trim().toLowerCase() ?? "";
  if (mime.startsWith("image/")) return mime;
  if (mime === "video/webm" || name.endsWith(".webm")) return "video/webm";
  if (
    mime.startsWith("video/") ||
    name.endsWith(".mp4") ||
    name.endsWith(".m4v") ||
    name.endsWith(".mov")
  ) {
    return "video/mp4";
  }
  return mime || "application/octet-stream";
}
