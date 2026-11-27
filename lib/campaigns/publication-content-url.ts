/** Persisted marker appended to notes when the user accepts a duplicate URL. */
export const PUBLICATION_DUPLICATE_NOTE_MARKER = "Duplicate";
export const PUBLICATION_COLLAB_NOTE_MARKER = "[Thinkway:Collab]";

export function notesHaveCollabMarker(notes: string | null | undefined): boolean {
  return (notes ?? '').split('\n').some(line => line.trim() === PUBLICATION_COLLAB_NOTE_MARKER);
}

const PARTNER_PREFIX = '[Thinkway:CollabCreator]';
export type PublicationCollabCreator = { id: string; name: string };
export function publicationCollabCreator(notes: string | null | undefined): PublicationCollabCreator | null {
  const line = (notes ?? '').split('\n').find(line => line.startsWith(PARTNER_PREFIX));
  try { const value = JSON.parse(decodeURIComponent(line?.slice(PARTNER_PREFIX.length) ?? '')); return typeof value.id === 'string' && typeof value.name === 'string' ? value : null; } catch { return null; }
}
export function setPublicationCollab(notes: string | null | undefined, collab: boolean, creator?: PublicationCollabCreator): string {
  const base = (notes ?? '').split('\n').filter(line => line.trim() !== PUBLICATION_COLLAB_NOTE_MARKER && !line.startsWith(PARTNER_PREFIX)).join('\n').trim();
  return collab ? [base, PUBLICATION_COLLAB_NOTE_MARKER, creator ? PARTNER_PREFIX + encodeURIComponent(JSON.stringify(creator)) : ''].filter(Boolean).join('\n') : base;
}

export function publicationCollabLabel(name: string | null | undefined, notes: string | null | undefined): string {
  const partner = publicationCollabCreator(notes);
  return `${name || 'Creator'}${notesHaveCollabMarker(notes) ? ' · Collab' + (partner ? ` with ${partner.name}` : '') : ''}`;
}

type CollabRow = { id: string; campaign_line_id: string | null; content_url: string | null; notes: string | null; influencer_name: string | null };
/** Keep the clicked creator as the editor context, even for reciprocal attribution. */
export function publicationCollabEditor<T extends CollabRow>(row: T, rows: T[], creators: PublicationCollabCreator[]) {
  const publication = attributeCollabPublications(rows).find(item => item.id === row.id) ?? row;
  return { publication, options: creators.filter(creator => creator.id !== publication.campaign_line_id).map(creator => ({value: creator.id, label: creator.name})) };
}
export function attributeCollabPublications<T extends CollabRow>(rows: T[]): T[] {
  return rows.map(row => {
    if (notesHaveCollabMarker(row.notes)) return row;
    const source = rows.find(item => notesHaveCollabMarker(item.notes) && publicationCollabCreator(item.notes)?.id === row.campaign_line_id && Boolean(normalizePublicationContentUrl(row.content_url)) && normalizePublicationContentUrl(item.content_url) === normalizePublicationContentUrl(row.content_url));
    return source ? { ...row, notes: setPublicationCollab(row.notes, true, { id: source.campaign_line_id ?? source.id, name: source.influencer_name ?? 'Creator' }) } : row;
  });
}
export function collabCellStyle(row: CollabRow, rows: CollabRow[]) {
  const shared = rows.find(item => notesHaveCollabMarker(item.notes) &&
    normalizePublicationContentUrl(item.content_url) === normalizePublicationContentUrl(row.content_url) &&
    (item.id === row.id || publicationCollabCreator(item.notes)?.id === row.campaign_line_id));
  if (!shared) return undefined;
  const key = [shared.campaign_line_id, publicationCollabCreator(shared.notes)?.id].sort().join(':');
  let hash = 0; for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const rgb = (n: number) => { const k=(n+hue/30)%12; return Math.round(255*(0.96-0.026*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0'); };
  return { backgroundColor: `#${rgb(0)}${rgb(8)}${rgb(4)}`, borderLeft: `3px solid hsl(${hue} 55% 48%)` };
}

/** Credit both creator rows while counting a shared publication only once. */
export function uniqueCollabPublications<T extends CollabRow>(rows: T[]): T[] {
  const sharedUrls = new Set(rows.filter(row => notesHaveCollabMarker(row.notes)).map(row => normalizePublicationContentUrl(row.content_url)).filter(Boolean));
  if (sharedUrls.size === 0) return rows;
  const seen = new Set<string>();
  const score = (row: T) => ['views','reach','impressions','likes','comments','shares','saves'].filter(key => typeof (row as Record<string, unknown>)[key] === 'number').length;
  const ranked = [...rows].sort((a,b) => score(b)-score(a) || a.id.localeCompare(b.id));
  const chosen = new Set(ranked.filter(row => {
    const url = normalizePublicationContentUrl(row.content_url);
    if (!url || !sharedUrls.has(url)) return true;
    if (seen.has(url)) return false;
    seen.add(url); return true;
  }).map(row => row.id));
  return rows.filter(row => chosen.has(row.id)).map(row => {
    const collab = rows.find(item => notesHaveCollabMarker(item.notes) && normalizePublicationContentUrl(item.content_url) === normalizePublicationContentUrl(row.content_url));
    if (!collab || collab.id === row.id) return row;
    return { ...row, notes: setPublicationCollab(row.notes, true, { id: collab.campaign_line_id ?? collab.id, name: collab.influencer_name ?? 'Creator' }) };
  });
}

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
    // Instagram exposes the same shortcode via /p/, /reel/ and /reels/ links.
    // Compare post identity, not the URL presentation chosen by each creator.
    if (url.hostname === "instagram.com") {
      const post = path.match(/^\/(?:p|reel|reels)\/([^/]+)$/);
      if (post) path = `/p/${post[1]}`;
    }
    if (!path) path = "";
    const query = url.searchParams.toString();
    return `${url.protocol}//${url.hostname}${path}${query ? `?${query}` : ""}`;
  } catch {
    return raw.toLowerCase().replace(/\/+$/, "");
  }
}

export function notesHaveDuplicateMarker(notes: string | null | undefined): boolean {
  if (notesHaveCollabMarker(notes)) return false;
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
  if (notesHaveCollabMarker(options?.notes)) return false;
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
