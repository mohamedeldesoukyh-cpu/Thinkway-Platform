/** Normalize provider timestamps to YYYY-MM-DD for campaign_publications.publication_date. */
export function normalizePublicationDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    if (/^\d{9,13}$/.test(trimmed)) {
      const fromEpoch = normalizePublicationDate(Number(trimmed));
      if (fromEpoch) return fromEpoch;
    }
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  return null;
}

const DATE_FIELD_KEYS = [
  "publication_date",
  "publishedAt",
  "published_at",
  "publishDate",
  "publish_date",
  "postDate",
  "post_date",
  "takenAt",
  "taken_at",
  "createTime",
  "create_time",
  "createTimeISO",
  "createTimeIso",
  "timestamp",
  "createdAt",
  "created_at",
  "createdTime",
  "created_time",
  "uploadDate",
  "upload_date",
  "date",
  "taken_at_timestamp",
  "takenAtTimestamp",
  "videoCreatedAt",
  "video_created_at",
] as const;

const NESTED_DATE_PATHS = [
  ["videoMeta", "createTime"],
  ["videoMeta", "createTimeISO"],
  ["videoMeta", "createTimeIso"],
  ["itemInfo", "itemStruct", "createTime"],
  ["itemInfo", "itemStruct", "createTimeISO"],
] as const;

function readNestedValue(row: Record<string, unknown>, path: readonly string[]): unknown {
  let current: unknown = row;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Walk nested provider/embedded JSON for TikTok-style createTime fields. */
export function findCreateTimeInJson(value: unknown, depth = 0): string | null {
  if (depth > 12 || value == null) return null;

  if (typeof value === "object") {
    if (!Array.isArray(value)) {
      const row = value as Record<string, unknown>;
      for (const key of ["createTime", "createTimeISO", "createTimeIso", "create_time"] as const) {
        if (key in row) {
          const normalized = normalizePublicationDate(row[key]);
          if (normalized) return normalized;
        }
      }
      for (const child of Object.values(row)) {
        const nested = findCreateTimeInJson(child, depth + 1);
        if (nested) return nested;
      }
    } else {
      for (const item of value) {
        const nested = findCreateTimeInJson(item, depth + 1);
        if (nested) return nested;
      }
    }
  }

  return null;
}

/** Extract a publication date from a provider payload row (Apify, Bright Data, etc.). */
export function extractPublicationDateFromProviderRow(
  row: Record<string, unknown> | null | undefined
): string | null {
  if (!row) return null;

  for (const key of DATE_FIELD_KEYS) {
    const normalized = normalizePublicationDate(row[key]);
    if (normalized) return normalized;
  }

  for (const path of NESTED_DATE_PATHS) {
    const normalized = normalizePublicationDate(readNestedValue(row, path));
    if (normalized) return normalized;
  }

  const nestedTakenAt = row.edge_media_to_caption;
  if (nestedTakenAt && typeof nestedTakenAt === "object" && "created_at" in nestedTakenAt) {
    const normalized = normalizePublicationDate(
      (nestedTakenAt as { created_at?: unknown }).created_at
    );
    if (normalized) return normalized;
  }

  return findCreateTimeInJson(row);
}

/** Parse embedded JSON in public page HTML (Playwright fallback when Apify is unavailable). */
export function extractPublicationDateFromHtml(
  platform: string,
  html: string
): string | null {
  if (!html) return null;

  if (platform === "tiktok") {
    for (const pattern of [
      /"createTimeISO"\s*:\s*"([^"]+)"/i,
      /"createTimeIso"\s*:\s*"([^"]+)"/i,
    ]) {
      const iso = html.match(pattern)?.[1];
      if (iso) {
        const normalized = normalizePublicationDate(iso);
        if (normalized) return normalized;
      }
    }

    const unix = html.match(/"createTime"\s*:\s*(\d{9,13})/i)?.[1];
    if (unix) {
      const normalized = normalizePublicationDate(Number(unix));
      if (normalized) return normalized;
    }

    for (const match of html.matchAll(
      /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi
    )) {
      const raw = match[1]?.trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as unknown;
        const fromBlob = findCreateTimeInJson(parsed);
        if (fromBlob) return fromBlob;
      } catch {
        continue;
      }
    }
  }

  if (platform === "instagram") {
    const taken = html.match(/"taken_at_timestamp"\s*:\s*(\d+)/)?.[1];
    if (taken) return normalizePublicationDate(Number(taken));
    const takenAt = html.match(/"taken_at"\s*:\s*(\d+)/)?.[1];
    if (takenAt) return normalizePublicationDate(Number(takenAt));
  }

  if (platform === "youtube") {
    const publishDate = html.match(/"publishDate"\s*:\s*"([^"]+)"/)?.[1];
    if (publishDate) return normalizePublicationDate(publishDate);
    const uploadDate = html.match(/"uploadDate"\s*:\s*"([^"]+)"/)?.[1];
    if (uploadDate) return normalizePublicationDate(uploadDate);
  }

  return null;
}
