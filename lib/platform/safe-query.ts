import { devLog, errorLog, performanceLog, startTimer } from "@/lib/platform/logger";
import { classifyQueryError } from "@/lib/platform/schema-validation";

export type SafeQueryErrorCode = "schema" | "rls" | "relationship" | "unknown" | null;

export type SafeQueryResult<T> = {
  ok: boolean;
  data: T;
  error: string | null;
  errorCode: SafeQueryErrorCode;
  fallbackUsed: boolean;
  durationMs: number;
  label: string;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function runSafeQuery<T>(
  scope: string,
  label: string,
  factory: () => Promise<T>,
  fallback: T,
  options?: { rethrowOperational?: boolean }
): Promise<SafeQueryResult<T>> {
  const started = startTimer();

  try {
    const data = await factory();
    performanceLog(scope, label, started, { ok: true });
    return {
      ok: true,
      data,
      error: null,
      errorCode: null,
      fallbackUsed: false,
      durationMs: Math.round(performance.now() - started),
      label,
    };
  } catch (error) {
    const message = toErrorMessage(error);
    const errorCode = classifyQueryError(message);

    errorLog(scope, `${label} failed`, { message, errorCode });

    if (options?.rethrowOperational && errorCode === "rls") {
      throw error;
    }

    devLog(scope, `${label} using fallback`, { message });

    return {
      ok: false,
      data: fallback,
      error: message,
      errorCode,
      fallbackUsed: true,
      durationMs: Math.round(performance.now() - started),
      label,
    };
  }
}

/** Generic server/data loader — never throws unless rethrowOperational. */
export async function safeServerQuery<T>(
  label: string,
  factory: () => Promise<T>,
  fallback: T
): Promise<SafeQueryResult<T>> {
  return runSafeQuery("safe-query", label, factory, fallback);
}

/** Analytics enrichment — must never block ERP routes. */
export async function safeAnalyticsQuery<T>(
  label: string,
  factory: () => Promise<T>,
  fallback: T
): Promise<SafeQueryResult<T>> {
  return runSafeQuery("safe-query", `analytics:${label}`, factory, fallback);
}

/** Planning module queries — optional enrichment. */
export async function safePlanningQuery<T>(
  label: string,
  factory: () => Promise<T>,
  fallback: T
): Promise<SafeQueryResult<T>> {
  return runSafeQuery("safe-query", `planning:${label}`, factory, fallback);
}

/**
 * Core operational ERP queries (billing, invoices, campaigns).
 * Still returns fallback on failure; use rethrowOperational for auth-only cases.
 */
export async function safeOperationalQuery<T>(
  label: string,
  factory: () => Promise<T>,
  fallback: T,
  options?: { critical?: boolean }
): Promise<SafeQueryResult<T>> {
  return runSafeQuery(
    "operational-isolation",
    label,
    factory,
    fallback,
    { rethrowOperational: options?.critical ?? false }
  );
}
