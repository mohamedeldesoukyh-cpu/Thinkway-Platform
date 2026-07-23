export type DecisionLogEvent =
  | "decision_started"
  | "decision_complete"
  | "decision_trace"
  | "decision_metrics"
  | "freshness_rule"
  | "governance_trace"
  | "execution_trace"
  | "execution_complete"
  | "execution_operational_metrics"
  | "execution_duration"
  | "decision_analytics";

export function logDecisionEvent(
  event: DecisionLogEvent,
  data: Record<string, unknown>
): void {
  console.log(`[creator-enrichment:decision] ${event}`, JSON.stringify(data));
}
