/** Persisted marker appended to notes when the user accepts a duplicate URL. */
export const PUBLICATION_DUPLICATE_NOTE_MARKER = "Duplicate";

/**
 * Normalize a publication content URL for duplicate comparison.
 * Trims, lowercases host, strips trailing slash and common tracking params noise.
 */
export function normalizePublicationContentUrl(
  contentUrl: string | null | undefined
): string | null {
  const raw = contentUrl?.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    // Drop common share/tracking query params so the same post matches.
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.startsWith("utm_") ||
        key === "igsh" ||
        key === "igshid" ||
        key === "fbclid" ||
        key === "si"
      ) {
        url.searchParams.delete(key);
      }
    }
    let path = url.pathname.replace(/\/+$/, "");
    if (!path) path = "";
    const query = url.searchParams.toString();
    return `${url.protocol}//${url.hostname}${path}${query ? `?${query}` : ""}`;
  } catch {
    return raw.toLowerCase().replace(/\/+$/, "");
  }
}

export function notesHaveDuplicateMarker(notes: string | null | undefined): boolean {
  if (!notes?.trim()) return false;
  return notes
    .split(/[\n,|]+/)
    .map((part) => part.trim().toLowerCase())
    .some((part) => part === PUBLICATION_DUPLICATE_NOTE_MARKER.toLowerCase());
}

export function appendDuplicateNoteMarker(notes: string | null | undefined): string {
  const base = notes?.trim() ?? "";
  if (notesHaveDuplicateMarker(base)) return base;
  if (!base) return PUBLICATION_DUPLICATE_NOTE_MARKER;
  return `${base}\n${PUBLICATION_DUPLICATE_NOTE_MARKER}`;
}

/** Normalized URLs that appear more than once in the list. */
export function duplicateNormalizedUrlSet(
  contentUrls: readonly (string | null | undefined)[]
): Set<string> {
  const counts = new Map<string, number>();
  for (const raw of contentUrls) {
    const key = normalizePublicationContentUrl(raw);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [key, count] of counts) {
    if (count > 1) duplicates.add(key);
  }
  return duplicates;
}

export function isDuplicatePublicationUrl(
  contentUrl: string | null | undefined,
  existingNormalizedUrls: ReadonlySet<string>,
  options?: { notes?: string | null }
): boolean {
  if (notesHaveDuplicateMarker(options?.notes)) return true;
  const key = normalizePublicationContentUrl(contentUrl);
  if (!key) return false;
  return existingNormalizedUrls.has(key);
}

export type DuplicateUrlHit = {
  url: string;
  normalized: string;
  reason: "existing" | "batch";
};

/** Find URLs in the incoming batch that collide with existing pubs or with each other. */
export function findDuplicatePublicationUrls(input: {
  candidateUrls: readonly string[];
  existingUrls: readonly (string | null | undefined)[];
}): DuplicateUrlHit[] {
  const existing = new Set(
    input.existingUrls
      .map((url) => normalizePublicationContentUrl(url))
      .filter((url): url is string => Boolean(url))
  );

  const seenInBatch = new Map<string, string>();
  const hits: DuplicateUrlHit[] = [];
  const reported = new Set<string>();

  for (const raw of input.candidateUrls) {
    const normalized = normalizePublicationContentUrl(raw);
    if (!normalized) continue;

    if (existing.has(normalized)) {
      if (!reported.has(normalized)) {
        hits.push({ url: raw, normalized, reason: "existing" });
        reported.add(normalized);
      }
      continue;
    }

    if (seenInBatch.has(normalized)) {
      if (!reported.has(normalized)) {
        hits.push({ url: raw, normalized, reason: "batch" });
        reported.add(normalized);
      }
      continue;
    }

    seenInBatch.set(normalized, raw);
  }

  return hits;
}
