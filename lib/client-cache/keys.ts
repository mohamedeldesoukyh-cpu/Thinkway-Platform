/**
 * Stable, order-independent JSON fingerprinting for cache keys.
 * No crypto dependency — sync FNV-1a so callers stay non-blocking.
 */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

/** FNV-1a 32-bit → compact base36. */
export function hashStable(value: unknown): string {
  const input = typeof value === "string" ? value : stableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export type ClientCacheKeyParts = {
  schemaVersion: number;
  userId: string;
  namespace: string;
  kind: string;
  fingerprint: string;
};

/**
 * Canonical key shape:
 * `tw:v{schema}:{userId}:{namespace}:{kind}:{fingerprint}`
 */
export function buildClientCacheKey(parts: ClientCacheKeyParts): string {
  const userId = parts.userId.trim() || "anon";
  const namespace = parts.namespace.trim();
  const kind = parts.kind.trim();
  const fingerprint = parts.fingerprint.trim();
  if (!namespace || !kind || !fingerprint) {
    throw new Error("client-cache key requires namespace, kind, and fingerprint");
  }
  return `tw:v${parts.schemaVersion}:${userId}:${namespace}:${kind}:${fingerprint}`;
}

export function buildFingerprintedKey(
  parts: Omit<ClientCacheKeyParts, "fingerprint"> & { payload: unknown }
): string {
  return buildClientCacheKey({
    ...parts,
    fingerprint: hashStable(parts.payload),
  });
}

export function clientCacheKeyPrefix(parts: {
  schemaVersion: number;
  userId: string;
  namespace: string;
  kind?: string;
}): string {
  const userId = parts.userId.trim() || "anon";
  const base = `tw:v${parts.schemaVersion}:${userId}:${parts.namespace.trim()}`;
  if (parts.kind?.trim()) {
    return `${base}:${parts.kind.trim()}:`;
  }
  return `${base}:`;
}
