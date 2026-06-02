type LogLevel = "debug" | "warn" | "error" | "perf";

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function formatPrefix(scope: string, level: LogLevel): string {
  return `[${scope}]`;
}

function write(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  if (level === "debug" && !isDev()) return;

  const prefix = formatPrefix(scope, level);
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

/** Warnings — development only to avoid console spam in production. */
export function warnLog(scope: string, message: string, detail?: unknown): void {
  write("warn", scope, message, detail);
}

/** Errors — always logged (production-safe message only in UI). */
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
