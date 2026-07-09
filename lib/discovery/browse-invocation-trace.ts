/**
 * Client + server tracing for browseUnifiedCreatorsAction call sites.
 * Enable server logs: AI_SEARCH_TRACE=1
 * Enable client logs: NEXT_PUBLIC_BROWSE_INVOCATION_TRACE=1 (or development)
 */

export type BrowseInvocationCaller =
  | "initial_search"
  | "ai_brief_search"
  | "filter_sync"
  | "url_sync"
  | "poll_completion_refresh"
  | "pagination"
  | "import_refresh"
  | "manual_retry"
  | "explicit_run_search"
  | "unknown";

export type BrowseInvocationTrace = {
  caller: BrowseInvocationCaller;
  requestId?: number;
  acquisitionJobId?: string | null;
  pollSeq?: number;
};

export type AcquisitionPollTrace = {
  jobId: string;
  pollSeq: number;
  status: string | null;
  completed: boolean;
  failed: boolean;
};

function clientTraceEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_BROWSE_INVOCATION_TRACE === "1"
  );
}

function serverTraceEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.AI_SEARCH_TRACE === "1" ||
    process.env.AI_SEARCH_DIAG === "1"
  );
}

export function traceBrowseInvocationClient(
  trace: BrowseInvocationTrace,
  extra?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || !clientTraceEnabled()) return;
  console.info("[browse-invocation:client]", trace.caller, {
    ...trace,
    ...extra,
    at: new Date().toISOString(),
  });
}

export function traceBrowseInvocationServer(
  trace: BrowseInvocationTrace,
  extra?: Record<string, unknown>
): void {
  if (!serverTraceEnabled()) return;
  console.info("[browse-invocation:server]", trace.caller, {
    ...trace,
    ...extra,
    at: new Date().toISOString(),
  });
}

export function traceAcquisitionPollClient(
  trace: AcquisitionPollTrace,
  extra?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || !clientTraceEnabled()) return;
  console.info("[acquisition-poll:client]", {
    ...trace,
    ...extra,
    at: new Date().toISOString(),
  });
}

export function traceAcquisitionPollServer(
  jobId: string,
  status: string,
  extra?: Record<string, unknown>
): void {
  if (!serverTraceEnabled()) return;
  console.info("[acquisition-poll:server]", {
    jobId,
    status,
    ...extra,
    at: new Date().toISOString(),
  });
}
