/**
 * In-process AI provider metrics. Call recordAi* from AI clients when wiring.
 * Survives only for the current Node process (edge/serverless resets).
 */

export type AiProviderMetrics = {
  requests: number;
  errors: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  avgLatencyMs: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailure: string | null;
  latencySamples: number[];
};

const store = new Map<string, AiProviderMetrics>();

function empty(): AiProviderMetrics {
  return {
    requests: 0,
    errors: 0,
    tokensIn: 0,
    tokensOut: 0,
    estimatedCostUsd: 0,
    avgLatencyMs: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailure: null,
    latencySamples: [],
  };
}

export function getAiProviderMetrics(providerId: string): AiProviderMetrics {
  return { ...(store.get(providerId) ?? empty()) };
}

export function recordAiSuccess(input: {
  providerId: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  estimatedCostUsd?: number;
}): void {
  const current = store.get(input.providerId) ?? empty();
  const samples = [...current.latencySamples, input.latencyMs].slice(-50);
  const avg =
    samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
  store.set(input.providerId, {
    ...current,
    requests: current.requests + 1,
    tokensIn: current.tokensIn + (input.tokensIn ?? 0),
    tokensOut: current.tokensOut + (input.tokensOut ?? 0),
    estimatedCostUsd:
      current.estimatedCostUsd + (input.estimatedCostUsd ?? 0),
    avgLatencyMs: Math.round(avg),
    lastSuccessAt: new Date().toISOString(),
    latencySamples: samples,
  });
}

export function recordAiFailure(input: {
  providerId: string;
  error: string;
  latencyMs?: number;
}): void {
  const current = store.get(input.providerId) ?? empty();
  store.set(input.providerId, {
    ...current,
    requests: current.requests + 1,
    errors: current.errors + 1,
    lastFailureAt: new Date().toISOString(),
    lastFailure: input.error,
    avgLatencyMs:
      input.latencyMs != null
        ? Math.round(
            ((current.avgLatencyMs ?? input.latencyMs) + input.latencyMs) / 2,
          )
        : current.avgLatencyMs,
  });
}

/** Test helper */
export function resetAiMetricsStore(): void {
  store.clear();
}
