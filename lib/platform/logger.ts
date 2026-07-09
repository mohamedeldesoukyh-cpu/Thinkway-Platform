type LogLevel = "debug" | "warn" | "error" | "perf";

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function isServer(): boolean {
  return typeof window === "undefined";
}

function writeStructured(
  level: LogLevel,
  scope: string,
  message: string,
  detail?: unknown
): void {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: scope,
    message,
    environment: process.env.THINKWAY_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  };

  if (detail !== undefined) {
    if (typeof detail === "object" && detail !== null && !Array.isArray(detail)) {
      Object.assign(payload, detail);
    } else {
      payload.detail = detail;
    }
  }

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function write(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  if (level === "debug" && !isDev()) return;

  const useStructured =
    isServer() &&
    (process.env.STRUCTURED_LOGS === "1" ||
      process.env.NODE_ENV === "production" ||
      process.env.THINKWAY_ENV === "production");

  if (useStructured && level !== "debug" && level !== "perf") {
    writeStructured(level, scope, message, detail);
    return;
  }

  const prefix = `[${scope}]`;
  const payload = detail !== undefined ? [message, detail] : [message];

  switch (level) {
    case "warn":
      console.warn(prefix, ...payload);
      break;
    case "error":
      console.error(prefix, ...payload);
      break;
    case "perf":
      if (isDev()) console.debug(prefix, ...payload);
      break;
    default:
      if (isDev()) console.debug(prefix, ...payload);
      break;
  }
}

/** Development-only log. No-op in production. Supports scoped or legacy call styles. */
export function devLog(...args: unknown[]): void {
  if (!isDev()) return;
  console.debug(...args);
}

/** Warnings — structured JSON on server in production. */
export function warnLog(scope: string, message: string, detail?: unknown): void {
  write("warn", scope, message, detail);
}

/** Errors — always logged (structured JSON on server in production). */
export function errorLog(scope: string, message: string, detail?: unknown): void {
  write("error", scope, message, detail);
}

export function performanceLog(
  scope: string,
  label: string,
  startedAt: number,
  detail?: Record<string, unknown>
): void {
  if (!isDev()) return;
  write("perf", scope, label, {
    durationMs: Math.round(performance.now() - startedAt),
    ...detail,
  });
}

export function startTimer(): number {
  return performance.now();
}

/** Server routes should prefer `@/lib/observability/structured-logger` for full context fields. */
export function infoLog(
  scope: string,
  message: string,
  detail?: Record<string, unknown>
): void {
  if (isDev()) {
    console.info(`[${scope}]`, message, detail ?? "");
    return;
  }
  writeStructured("debug", scope, message, detail);
}
