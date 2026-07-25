/** Safe Redis URL diagnostics (never returns passwords). */

export type RedisEndpointInfo = {
  envVar: "REDIS_URL";
  configured: boolean;
  protocol: string | null;
  host: string | null;
  port: number | null;
  db: number | null;
  hasAuth: boolean;
  /** Redacted connection string suitable for UI / logs */
  redactedUrl: string | null;
  isLocalHost: boolean;
  parseError: string | null;
};

export function parseRedisEndpoint(
  url: string | null | undefined = process.env.REDIS_URL,
): RedisEndpointInfo {
  const raw = url?.trim() || null;
  if (!raw) {
    return {
      envVar: "REDIS_URL",
      configured: false,
      protocol: null,
      host: null,
      port: null,
      db: null,
      hasAuth: false,
      redactedUrl: null,
      isLocalHost: false,
      parseError: null,
    };
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname || null;
    const port = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === "rediss:"
        ? 6380
        : 6379;
    const dbSegment = parsed.pathname.replace(/^\//, "");
    const db = dbSegment ? Number(dbSegment) : 0;
    const hasAuth = Boolean(parsed.password || parsed.username);
    const authPart = hasAuth ? "***@" : "";
    const dbPart = db ? `/${db}` : "";
    const redactedUrl = `${parsed.protocol}//${authPart}${host}:${port}${dbPart}`;
    const isLocalHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "redis";

    return {
      envVar: "REDIS_URL",
      configured: true,
      protocol: parsed.protocol.replace(/:$/, ""),
      host,
      port: Number.isFinite(port) ? port : null,
      db: Number.isFinite(db) ? db : 0,
      hasAuth,
      redactedUrl,
      isLocalHost,
      parseError: null,
    };
  } catch (error) {
    return {
      envVar: "REDIS_URL",
      configured: true,
      protocol: null,
      host: null,
      port: null,
      db: null,
      hasAuth: false,
      redactedUrl: null,
      isLocalHost: false,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function suggestedRedisLocalFix(endpoint: RedisEndpointInfo): string {
  if (!endpoint.configured) {
    return "Set REDIS_URL=redis://127.0.0.1:6379 in .env (see .env.example), then start Redis: docker compose -f docker-compose.discovery.yml up -d redis";
  }
  if (endpoint.parseError) {
    return "Fix REDIS_URL syntax (example: redis://127.0.0.1:6379).";
  }
  if (endpoint.isLocalHost) {
    return `Start local Redis on ${endpoint.host}:${endpoint.port} — e.g. docker compose -f docker-compose.discovery.yml up -d redis (or Memurai on Windows).`;
  }
  return `Verify network/TLS/auth to ${endpoint.host}:${endpoint.port}. Do not point local .env at production Redis unless explicitly approved.`;
}
