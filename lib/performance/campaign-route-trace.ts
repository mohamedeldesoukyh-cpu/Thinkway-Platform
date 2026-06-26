/** Development tracing for campaign workspace / performance load paths. */

type TraceContext = Record<string, unknown>;

function traceEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function traceCampaignRoute(stage: string, context?: TraceContext): void {
  if (!traceEnabled()) return;
  console.log(`[campaign-route-trace] ${stage}`, context ?? {});
}

export function traceCampaignRouteError(
  stage: string,
  error: unknown,
  context?: TraceContext
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[campaign-route-trace] ${stage}:error`, {
    ...context,
    message,
    stack,
  });
}
