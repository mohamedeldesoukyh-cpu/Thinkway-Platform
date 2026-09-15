import type { CreatorRecentPublication } from "@/lib/creators/types";
import type { ReactNode } from "react";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function sourceDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function peopleLabel(
  people: NonNullable<CreatorRecentPublication["taggedUsers"]>
): string | null {
  const labels = people
    .map((person) => (person.username ? `@${person.username.replace(/^@/, "")}` : person.displayName))
    .filter((value): value is string => Boolean(value));
  if (labels.length === 0) return null;
  const visible = labels.slice(0, 4);
  return labels.length > visible.length ? `${visible.join(", ")} +${labels.length - visible.length}` : visible.join(", ");
}

function row(label: string, value: string | null): ReactNode {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <span className="font-medium text-foreground/75">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Publication-level source evidence, shared by both canonical Creator Details
 * presentations. Unknown source fields are omitted rather than inferred.
 */
export function PublicationEvidenceDetails({
  publication,
  compact = false,
}: {
  publication: CreatorRecentPublication;
  compact?: boolean;
}) {
  const contentType = [publication.contentType, publication.productType]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ");
  const video = publication.video;
  const media = publication.media;
  const music = publication.music;
  const musicLabel = music
    ? [music.artistName, music.songName].filter((value): value is string => Boolean(value)).join(" — ") ||
      (music.usesOriginalAudio === true ? "Original audio" : null)
    : null;
  const videoParts = [
    video?.durationSeconds != null ? formatDuration(video.durationSeconds) : null,
    video?.playCount != null ? `${formatCount(video.playCount)} plays` : null,
    video?.viewCount != null ? `${formatCount(video.viewCount)} views` : null,
  ].filter((value): value is string => Boolean(value));
  const mediaParts = [
    media?.width != null && media.height != null ? `${media.width}×${media.height}` : null,
    media && media.imageUrls.length > 1 ? `${media.imageUrls.length} carousel images` : null,
    media && media.childPostUrls.length > 0 ? `${media.childPostUrls.length} child posts` : null,
  ].filter((value): value is string => Boolean(value));
  const hasEvidence =
    Boolean(contentType) ||
    publication.paidPartnership != null ||
    (publication.taggedUsers?.length ?? 0) > 0 ||
    (publication.coauthorProducers?.length ?? 0) > 0 ||
    Boolean(publication.locationName || publication.locationId) ||
    Boolean(musicLabel || music?.audioUrl) ||
    videoParts.length > 0 ||
    mediaParts.length > 0 ||
    Boolean(publication.source?.capturedAt);

  if (!hasEvidence) return null;

  return (
    <div className={compact ? "mt-1.5 space-y-0.5 text-[9px] text-muted-foreground" : "mt-2 space-y-1 text-[10px] text-muted-foreground"}>
      {row("Content type", contentType || null)}
      {publication.paidPartnership != null
        ? row("Paid partnership", publication.paidPartnership ? "Indicated" : "Not indicated")
        : null}
      {row("Tagged accounts", publication.taggedUsers ? peopleLabel(publication.taggedUsers) : null)}
      {row(
        "Co-authors",
        publication.coauthorProducers ? peopleLabel(publication.coauthorProducers) : null
      )}
      {row(
        "Location",
        publication.locationName ?? (publication.locationId ? `Location ${publication.locationId}` : null)
      )}
      {row("Music / audio", musicLabel ?? (music?.audioUrl ? "Audio available" : null))}
      {row("Video", videoParts.join(" · ") || null)}
      {row("Media", mediaParts.join(" · ") || null)}
      {publication.source?.capturedAt && sourceDate(publication.source.capturedAt)
        ? row("Source", `Apify · ${sourceDate(publication.source.capturedAt)}`)
        : null}
    </div>
  );
}
