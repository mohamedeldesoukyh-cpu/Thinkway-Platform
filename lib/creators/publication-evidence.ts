import type {
  CreatorPublicationMedia,
  CreatorPublicationMusic,
  CreatorPublicationPerson,
  CreatorPublicationSource,
  CreatorPublicationVideo,
  CreatorRecentPublication,
} from "@/lib/creators/types";

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(stringValue).filter((item): item is string => Boolean(item)))];
}

function normalizePeople(value: unknown): CreatorPublicationPerson[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const people: CreatorPublicationPerson[] = [];
  for (const item of value) {
    const row = objectValue(item);
    if (!row) continue;
    const person: CreatorPublicationPerson = {
      id: stringValue(row.id),
      username: stringValue(row.username),
      displayName:
        stringValue(row.full_name) ?? stringValue(row.fullName) ?? stringValue(row.displayName),
      isVerified: booleanValue(row.is_verified) ?? booleanValue(row.isVerified),
    };
    const key = person.id ?? person.username?.toLowerCase() ?? person.displayName?.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    people.push(person);
  }
  return people;
}

function normalizeMusic(row: Record<string, unknown>): CreatorPublicationMusic | null {
  const source = objectValue(row.musicInfo) ?? objectValue(row.music);
  const audioUrl = stringValue(row.audioUrl) ?? stringValue(source?.audio_url) ?? stringValue(source?.audioUrl);
  const music: CreatorPublicationMusic = {
    audioId: stringValue(source?.audio_id) ?? stringValue(source?.audioId),
    songName: stringValue(source?.song_name) ?? stringValue(source?.songName),
    artistName: stringValue(source?.artist_name) ?? stringValue(source?.artistName),
    audioUrl,
    usesOriginalAudio:
      booleanValue(source?.uses_original_audio) ?? booleanValue(source?.usesOriginalAudio),
  };
  return Object.values(music).some((value) => value != null) ? music : null;
}

function normalizeVideo(row: Record<string, unknown>): CreatorPublicationVideo | null {
  const source = objectValue(row.video);
  const video: CreatorPublicationVideo = {
    durationSeconds: numberValue(row.videoDuration) ?? numberValue(source?.durationSeconds),
    playCount:
      numberValue(row.videoPlayCount) ?? numberValue(row.playCount) ?? numberValue(source?.playCount),
    viewCount:
      numberValue(row.videoViewCount) ?? numberValue(row.viewCount) ?? numberValue(source?.viewCount),
    url: stringValue(row.videoUrl) ?? stringValue(row.webVideoUrl) ?? stringValue(source?.url),
  };
  return Object.values(video).some((value) => value != null) ? video : null;
}

function normalizeMedia(row: Record<string, unknown>): CreatorPublicationMedia | null {
  const source = objectValue(row.media);
  const media: CreatorPublicationMedia = {
    displayUrl: stringValue(row.displayUrl) ?? stringValue(source?.displayUrl),
    width: numberValue(row.dimensionsWidth) ?? numberValue(source?.width),
    height: numberValue(row.dimensionsHeight) ?? numberValue(source?.height),
    originalWidth: numberValue(row.originalWidth) ?? numberValue(source?.originalWidth),
    originalHeight: numberValue(row.originalHeight) ?? numberValue(source?.originalHeight),
    imageUrls: stringArray(row.images).length > 0 ? stringArray(row.images) : stringArray(source?.imageUrls),
    childPostUrls:
      stringArray(row.childPosts).length > 0
        ? stringArray(row.childPosts)
        : stringArray(source?.childPostUrls),
  };
  return Object.values(media).some((value) => (Array.isArray(value) ? value.length > 0 : value != null))
    ? media
    : null;
}

function normalizeSource(value: unknown): CreatorPublicationSource | null {
  const row = objectValue(value);
  if (!row || row.provider !== "apify") return null;
  return {
    provider: "apify",
    apifyRunId: stringValue(row.apifyRunId),
    apifyDatasetId: stringValue(row.apifyDatasetId),
    platformPostId: stringValue(row.platformPostId),
    capturedAt: stringValue(row.capturedAt),
  };
}

export function normalizeCreatorPublicationEvidence(
  row: Record<string, unknown>,
  source?: CreatorPublicationSource | null
): Pick<
  CreatorRecentPublication,
  | "platformPostId"
  | "source"
  | "contentType"
  | "productType"
  | "paidPartnership"
  | "taggedUsers"
  | "coauthorProducers"
  | "locationName"
  | "locationId"
  | "music"
  | "video"
  | "media"
> {
  const platformPostId = stringValue(row.platformPostId) ?? stringValue(row.id) ?? stringValue(row.shortCode);
  const effectiveSource = source ?? normalizeSource(row.source);
  const taggedUsers = normalizePeople(row.taggedUsers);
  const coauthorProducers = normalizePeople(row.coauthorProducers);
  return {
    ...(platformPostId ? { platformPostId } : {}),
    ...(effectiveSource
      ? { source: { ...effectiveSource, platformPostId: platformPostId ?? effectiveSource.platformPostId } }
      : {}),
    ...(stringValue(row.contentType) ?? stringValue(row.type)
      ? { contentType: stringValue(row.contentType) ?? stringValue(row.type) }
      : {}),
    ...(stringValue(row.productType) ? { productType: stringValue(row.productType) } : {}),
    ...(booleanValue(row.paidPartnership) != null
      ? { paidPartnership: booleanValue(row.paidPartnership) }
      : {}),
    ...(taggedUsers.length > 0 ? { taggedUsers } : {}),
    ...(coauthorProducers.length > 0 ? { coauthorProducers } : {}),
    ...(stringValue(row.locationName) ? { locationName: stringValue(row.locationName) } : {}),
    ...(row.locationId != null ? { locationId: String(row.locationId) } : {}),
    ...(normalizeMusic(row) ? { music: normalizeMusic(row) } : {}),
    ...(normalizeVideo(row) ? { video: normalizeVideo(row) } : {}),
    ...(normalizeMedia(row) ? { media: normalizeMedia(row) } : {}),
  };
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function stableValueKey(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValueKey).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValueKey(record[key])}`)
    .join(",")}}`;
}

function mergeValue<T>(current: T, incoming: T): T {
  if (!hasValue(incoming)) return current;
  if (Array.isArray(current) && Array.isArray(incoming)) {
    const seen = new Set<string>();
    return [...current, ...incoming].filter((item) => {
      const key = stableValueKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }) as T;
  }
  if (
    current &&
    incoming &&
    typeof current === "object" &&
    typeof incoming === "object" &&
    !Array.isArray(current) &&
    !Array.isArray(incoming)
  ) {
    const merged: Record<string, unknown> = { ...current as object };
    for (const [key, value] of Object.entries(incoming as object)) {
      merged[key] = mergeValue(merged[key], value);
    }
    return merged as T;
  }
  // Historical post evidence is strictly additive: a retained Apify response
  // can contain rotating media URLs or later counter snapshots, neither of
  // which should churn a good observed value already stored on the post.
  return hasValue(current) ? current : incoming;
}

function personIdentity(value: unknown): string | null {
  const person = objectValue(value);
  if (!person) return null;
  const id = stringValue(person.id);
  if (id) return `id:${id}`;
  const username = stringValue(person.username)?.replace(/^@+/, "").toLowerCase();
  return username ? `username:${username}` : null;
}

function mergePeople<T>(current: T, incoming: T): T {
  if (!Array.isArray(current) || !Array.isArray(incoming)) return mergeValue(current, incoming);
  const output: unknown[] = [];
  const byIdentity = new Map<string, number>();

  for (const person of [...current, ...incoming]) {
    const identity = personIdentity(person);
    if (!identity || !byIdentity.has(identity)) {
      if (identity) byIdentity.set(identity, output.length);
      output.push(person);
      continue;
    }
    const index = byIdentity.get(identity)!;
    output[index] = mergeValue(output[index], person);
  }
  return output as T;
}

function mergePublicationSource(current: unknown, incoming: unknown): unknown {
  if (!hasValue(incoming)) return current;
  if (!hasValue(current)) return incoming;
  // One complete source record is sufficient provenance for a publication.
  // Retained runs can expose the same post through a later dataset; that is not
  // a semantic publication change and must not create convergence churn.
  return current;
}

function mediaUrlIdentity(value: unknown): string {
  if (typeof value !== "string") return stableValueKey(value);
  try {
    const url = new URL(value);
    // CDN hostnames and query signatures are ephemeral. The stable media asset
    // identity is the path retained by the provider, not its delivery host.
    return url.pathname.toLowerCase();
  } catch {
    return value;
  }
}

function mergeMedia<T>(current: T, incoming: T): T {
  if (!current || !incoming || typeof current !== "object" || typeof incoming !== "object") {
    return mergeValue(current, incoming);
  }
  const merged: Record<string, unknown> = { ...(current as object) };
  for (const [key, value] of Object.entries(incoming as object)) {
    if ((key === "imageUrls" || key === "childPostUrls") && Array.isArray(value)) {
      const existing = Array.isArray(merged[key]) ? merged[key] : [];
      const seen = new Set<string>();
      merged[key] = [...existing, ...value].filter((item) => {
        const identity = mediaUrlIdentity(item);
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
      continue;
    }
    merged[key] = mergeValue(merged[key], value);
  }
  return merged as T;
}

export function canonicalPublicationUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "instagram.com") {
      const match = url.pathname.match(/^\/(?:p|reel|reels|tv)\/([^/]+)\/?$/);
      // Shortcodes are case-sensitive. /p and /reel can address the same post.
      return match ? `https://instagram.com/p/${match[1]}` : null;
    }
    return `${url.protocol}//${host}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

export type PublicationIdentityIssue = { kind: "conflict" | "ambiguous"; publication: CreatorRecentPublication };

/**
 * Deduplicate by a stable platform post id (or canonical URL fallback) and only
 * overlay meaningful incoming fields. Historical evidence can enrich a post but
 * cannot erase an existing observed field with null/empty data.
 */
export function mergeCreatorRecentPublications(
  existing: unknown,
  incoming: CreatorRecentPublication[],
  onIssue?: (issue: PublicationIdentityIssue) => void
): CreatorRecentPublication[] {
  const base = Array.isArray(existing) ? (existing as CreatorRecentPublication[]) : [];
  const output: CreatorRecentPublication[] = [];
  // Pre-index claims across both sets, so an early URL-only row cannot bridge
  // two different stable IDs depending on input order.
  const claims = new Map<string, Set<string>>();
  for (const publication of [...base, ...incoming]) {
    const url = canonicalPublicationUrl(publication.url);
    const id = publication.platformPostId?.trim();
    if (url && id) claims.set(url, new Set([...(claims.get(url) ?? []), id]));
  }

  const add = (publication: CreatorRecentPublication, retained: boolean) => {
    const id = publication.platformPostId?.trim();
    const url = canonicalPublicationUrl(publication.url);
    const conflictingUrl = url != null && (claims.get(url)?.size ?? 0) > 1;
    if (conflictingUrl) {
      onIssue?.({ kind: "conflict", publication });
      if (retained) output.push(publication);
      return;
    }
    const matches = output.flatMap((current, index) => {
      const currentId = current.platformPostId?.trim();
      const sameId = id && currentId && id === currentId;
      const sameUrl = url && url === canonicalPublicationUrl(current.url);
      return sameId || (sameUrl && (!id || !currentId || id === currentId)) ? [index] : [];
    });
    if (matches.length > 1) {
      onIssue?.({ kind: "ambiguous", publication });
      if (retained) output.push(publication);
      return;
    }
    if (matches.length === 0) {
      output.push(publication);
      return;
    }
    const index = matches[0]!;
    const current = output[index]!;
    const merged = Object.fromEntries(
      Object.keys({ ...current, ...publication }).map((key) => [
        key,
        key === "source"
          ? mergePublicationSource(current.source, publication.source)
          : key === "taggedUsers" || key === "coauthorProducers"
            ? mergePeople(
                current[key as keyof CreatorRecentPublication],
                publication[key as keyof CreatorRecentPublication]
              )
            : key === "media"
              ? mergeMedia(
                  current[key as keyof CreatorRecentPublication],
                  publication[key as keyof CreatorRecentPublication]
                )
          : mergeValue(
              current[key as keyof CreatorRecentPublication],
              publication[key as keyof CreatorRecentPublication]
            ),
      ])
    ) as CreatorRecentPublication;
    output[index] = merged;
  };

  for (const publication of base) add(publication, true);
  for (const publication of incoming) add(publication, false);
  return output;
}
