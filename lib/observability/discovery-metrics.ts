import { logDuration, logInfo, logWarn } from "@/lib/observability/structured-logger";

export type DiscoveryOperation =
  | "search"
  | "browse"
  | "hydration"
  | "discovery_search_api"
  | "enrichment";

export type DiscoveryMetricsInput = {
  operation: DiscoveryOperation;
  path?: "ai" | "discovery" | "unknown";
  stage?: string;
  startedAt: number;
  count?: number;
  total?: number;
  filters?: Record<string, unknown>;
  status?: "ok" | "error" | "count_drop";
  error?: string;
};

/** Production-safe discovery latency logging (extends search-trace for prod). */
export function recordDiscoveryMetrics(input: DiscoveryMetricsInput): void {
  const message = `discovery.${input.operation}${input.stage ? `.${input.stage}` : ""}`;

  const fields = {
    service: "discovery",
    operation: input.operation,
    path: input.path,
    stage: input.stage,
    count: input.count,
    total: input.total,
    filters: input.filters,
    status: input.status ?? "ok",
    error: input.error,
  };

  if (input.status === "error") {
    logWarn("discovery-metrics", message, {
      ...fields,
      durationMs: Math.round(performance.now() - input.startedAt),
    });
    return;
  }

  if (input.status === "count_drop") {
    logWarn("discovery-metrics", `${message} count_drop`, {
      ...fields,
      durationMs: Math.round(performance.now() - input.startedAt),
    });
    return;
  }

  logDuration("discovery-metrics", message, input.startedAt, fields);
}

/** Bridge from search-trace stages to structured prod logs when trace env is off. */
export function recordSearchTraceMetric(
  stage: string,
  data: Record<string, unknown> | undefined,
  options?: { path?: "ai" | "discovery" | "unknown"; startedAt?: number }
): void {
  const operation: DiscoveryOperation =
    stage.includes("hydration")
      ? "hydration"
      : stage.includes("browse")
        ? "browse"
        : "search";

  recordDiscoveryMetrics({
    operation,
    path: options?.path,
    stage,
    startedAt: options?.startedAt ?? performance.now(),
    count:
      typeof data?.count === "number"
        ? data.count
        : typeof data?.countAfter === "number"
          ? data.countAfter
          : undefined,
    total: typeof data?.total === "number" ? data.total : undefined,
    filters: data,
    status: "ok",
  });
}

export function logDiscoveryApiBoundary(input: {
  route: string;
  startedAt: number;
  status: number;
  userId?: string;
  error?: string;
}): void {
  if (input.status >= 500) {
    logWarn("discovery-api", `${input.route} failed`, {
      service: "discovery-api",
      route: input.route,
      status: input.status,
      userId: input.userId,
      error: input.error,
      durationMs: Math.round(performance.now() - input.startedAt),
    });
    return;
  }

  logInfo("discovery-api", `${input.route} completed`, {
    service: "discovery-api",
    route: input.route,
    status: input.status,
    userId: input.userId,
    durationMs: Math.round(performance.now() - input.startedAt),
  });
}
