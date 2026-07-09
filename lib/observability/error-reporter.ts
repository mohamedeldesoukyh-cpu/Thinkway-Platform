import { getRequestContext } from "@/lib/observability/request-context";
import { getThinkwayEnvironment } from "@/lib/observability/environment";
import { logError } from "@/lib/observability/structured-logger";

export type ErrorReporterContext = {
  route?: string;
  service?: string;
  workflow?: string;
  requestId?: string;
  conversationId?: string;
  campaignId?: string;
  userId?: string;
  status?: number;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

/** True when SENTRY_DSN is set. Install @sentry/nextjs via wizard for full SDK capture. */
export function isErrorReportingEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

function mergeContext(context?: ErrorReporterContext): ErrorReporterContext {
  const req = getRequestContext();
  return {
    service: context?.service ?? req?.service,
    workflow: context?.workflow ?? req?.workflow,
    requestId: context?.requestId ?? req?.requestId,
    conversationId: context?.conversationId ?? req?.conversationId,
    campaignId: context?.campaignId ?? req?.campaignId,
    userId: context?.userId ?? req?.userId,
    ...context,
    tags: {
      environment: getThinkwayEnvironment(),
      sentryConfigured: String(isErrorReportingEnabled()),
      ...(context?.route ? { route: context.route } : {}),
      ...context?.tags,
    },
  };
}

/**
 * Capture an exception at API/worker/cron boundaries.
 * Always writes structured logs. When SENTRY_DSN is set and @sentry/nextjs is
 * installed (via `npx @sentry/wizard@latest -i nextjs`), Sentry global handlers
 * also receive unhandled errors.
 */
export function captureException(
  error: unknown,
  context?: ErrorReporterContext
): void {
  const merged = mergeContext(context);
  const message = error instanceof Error ? error.message : String(error);

  logError(merged.service ?? "error-reporter", message, {
    service: merged.service,
    workflow: merged.workflow,
    requestId: merged.requestId,
    conversationId: merged.conversationId,
    campaignId: merged.campaignId,
    userId: merged.userId,
    status: merged.status,
    error: message,
    route: merged.route,
    tags: merged.tags,
    ...merged.extra,
  });
}

/** Capture a message-level event (cron failures, worker alerts). */
export function captureMessage(
  message: string,
  _level: "info" | "warning" | "error" = "error",
  context?: ErrorReporterContext
): void {
  captureException(new Error(message), context);
}

/** Wrap an API handler boundary — reports failures without altering inner logic. */
export async function withErrorReporting<T>(
  context: ErrorReporterContext,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    captureException(error, context);
    throw error;
  }
}
