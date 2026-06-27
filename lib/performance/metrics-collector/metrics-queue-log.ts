export type MetricsQueueLogEvent =
  | "JOB_QUEUED"
  | "JOB_STARTED"
  | "JOB_COMPLETED"
  | "JOB_FAILED"
  | "STATUS_UPDATED";

export type MetricsQueueLogContext = {
  publicationId: string;
  jobId?: string | null;
  provider?: string | null;
  status?: string | null;
  attemptsMade?: number;
  error?: string;
};

export function logMetricsQueueEvent(
  event: MetricsQueueLogEvent,
  ctx: MetricsQueueLogContext
): void {
  const payload = {
    event,
    publicationId: ctx.publicationId,
    ...(ctx.jobId != null ? { jobId: ctx.jobId } : {}),
    ...(ctx.provider != null ? { provider: ctx.provider } : {}),
    ...(ctx.status != null ? { status: ctx.status } : {}),
    ...(ctx.attemptsMade != null ? { attemptsMade: ctx.attemptsMade } : {}),
    ...(ctx.error != null ? { error: ctx.error } : {}),
  };

  if (event === "JOB_FAILED" || (event === "STATUS_UPDATED" && ctx.error)) {
    console.error(`[publication-metrics] ${event}`, payload);
    return;
  }

  console.log(`[publication-metrics] ${event}`, payload);
}
