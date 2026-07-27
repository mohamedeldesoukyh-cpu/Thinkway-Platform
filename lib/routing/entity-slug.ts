/** Slugify a display name for URL segments (lowercase, hyphen-separated). */
export function slugifyDisplayName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** First 8 hex chars of a UUID (without dashes) for disambiguation in URLs. */
export function entityShortId(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 8).toLowerCase();
}

/** Human-readable document / serial prefixes accepted as legacy route keys. */
const DOCUMENT_NUMBER_PREFIXES = [
  "TW",
  "QT",
  "SL",
  "GRP",
  "BRD",
  "AGY",
  "INF",
  "C",
] as const;

export function isDocumentOrSerialRouteKey(value: string): boolean {
  const key = value.trim();
  if (!key) return false;
  const upper = key.toUpperCase();
  return DOCUMENT_NUMBER_PREFIXES.some((prefix) => {
    if (prefix === "C") return /^C-\d/.test(upper);
    return upper.startsWith(`${prefix}-`);
  });
}

export type ParsedEntityRouteKey =
  | { kind: "empty" }
  | { kind: "uuid"; uuid: string }
  | { kind: "documentNumber"; value: string }
  | { kind: "slugShortId"; slug: string; shortId: string }
  | { kind: "slug"; slug: string };

/** Parse a dynamic `[id]` route segment into lookup hints. */
export function parseEntityRouteKey(routeKey: string): ParsedEntityRouteKey {
  const key = decodeURIComponent(routeKey).trim();
  if (!key) return { kind: "empty" };

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRe.test(key)) return { kind: "uuid", uuid: key };

  if (isDocumentOrSerialRouteKey(key)) {
    return { kind: "documentNumber", value: key };
  }

  const shortIdMatch = key.match(/^(.+)-([0-9a-f]{8})$/i);
  if (shortIdMatch) {
    return {
      kind: "slugShortId",
      slug: shortIdMatch[1]!,
      shortId: shortIdMatch[2]!.toLowerCase(),
    };
  }

  return { kind: "slug", slug: key };
}

export type EntityRouteIdentity = {
  id: string;
  slug?: string | null;
  displayName?: string | null;
  documentNumber?: string | null;
};

/** Build the canonical route key for an entity detail page. */
export function buildEntityRouteKey(entity: EntityRouteIdentity): string {
  const slug = entity.slug?.trim() || slugifyDisplayName(entity.displayName ?? "");
  if (slug) return `${slug}-${entityShortId(entity.id)}`;

  const documentNumber = entity.documentNumber?.trim();
  if (documentNumber) return documentNumber;

  return entity.id;
}

/** Build a full entity detail path from a base path and entity identity. */
export function buildEntityDetailPath(
  basePath: string,
  entity: EntityRouteIdentity
): string {
  const normalizedBase = basePath.replace(/\/$/, "");
  return `${normalizedBase}/${encodeURIComponent(buildEntityRouteKey(entity))}`;
}

/** True when the incoming route key should redirect to the canonical key. */
export function shouldRedirectEntityRoute(
  routeKey: string,
  canonicalRouteKey: string
): boolean {
  return decodeURIComponent(routeKey).trim() !== canonicalRouteKey.trim();
}

/** Page title segment (root layout appends " · Thinkway"). */
export function entityPageTitle(displayName: string, meta?: string | null): string {
  const name = displayName.trim();
  const suffix = meta?.trim();
  if (name && suffix) return `${name} (${suffix})`;
  return name || suffix || "Thinkway";
}
