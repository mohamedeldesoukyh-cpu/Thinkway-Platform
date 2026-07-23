/**
 * Structured diagnostics for the manual creator refresh pipeline.
 * Log-only — does not change enqueue/queue/worker behaviour.
 */

export type ManualRefreshTraceStep =
  | "ui_click"
  | "ui_cache_assess"
  | "ui_execute"
  | "ui_complete"
  | "ui_poll_start"
  | "ui_poll_status"
  | "ui_poll_complete"
  | "action_enter"
  | "action_exit"
  | "impl_enter"
  | "impl_gate"
  | "impl_enqueue_start"
  | "impl_enqueue_result"
  | "impl_exit"
  | "queue_add_start"
  | "queue_add_result"
  | "worker_receive"
  | "worker_complete"
  | "worker_skip"
  | "worker_fail";

function redisHostFromEnv(): string | null {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw.replace(/^rediss:/i, "redis:")).hostname;
  } catch {
    return "unparseable";
  }
}

export function logManualRefreshTrace(
  step: ManualRefreshTraceStep,
  fields: Record<string, unknown> = {}
): void {
  const payload = {
    event: "manual_refresh_trace",
    step,
    ts: new Date().toISOString(),
    redisUrlConfigured: Boolean(process.env.REDIS_URL?.trim()),
    redisEnvHost: redisHostFromEnv(),
    ...fields,
  };
  console.log(`[manual-refresh-trace] ${JSON.stringify(payload)}`);
}
