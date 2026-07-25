import type { HealthProvider } from "./types";
import { resultBase, scoreFromStatus } from "./types";
import { getAiProviderMetrics } from "../metrics/ai-metrics-store";
import { withDiagnostics } from "../health/diagnostics";

function envConfiguredProvider(
  id: string,
  name: string,
  envKeys: string[],
  modelHint: string,
): HealthProvider {
  return {
    id,
    name,
    kind: "ai",
    weight: 1,
    async check() {
      const configured = envKeys.some((key) => Boolean(process.env[key]?.trim()));
      const metrics = getAiProviderMetrics(id);
      const now = Date.now();

      if (!configured) {
        return withDiagnostics(
          resultBase(this, {
            status: "unknown",
            latencyMs: null,
            message: `${name} API key not configured.`,
            meta: { configured: false, ...metrics },
          }),
          {
            reason: `API key missing — none of ${envKeys.join(", ")} are set.`,
            suggestedAction: `Set ${envKeys[0]} if ${name} is required in this environment.`,
            technicalDetails: {
              provider: name,
              model: modelHint,
              apiReachable: false,
              configured: false,
              averageLatencyMs: null,
              lastSuccessfulRequest: metrics.lastSuccessAt,
              lastFailure: metrics.lastFailureAt,
            },
          },
        );
      }

      const errorRate = metrics.requests > 0 ? metrics.errors / metrics.requests : 0;
      let status: import("../types").ComponentStatus = "healthy";
      let reason = `Provider healthy — ${name} configured; API assumed reachable.`;

      if (
        metrics.lastFailureAt &&
        now - Date.parse(metrics.lastFailureAt) < 15 * 60_000
      ) {
        status = errorRate > 0.25 ? "critical" : "warning";
        reason =
          status === "critical"
            ? `Recent failures with high error rate (${(errorRate * 100).toFixed(0)}%).`
            : `Recent failure within 15 minutes (error rate ${(errorRate * 100).toFixed(0)}%).`;
      } else if (errorRate > 0.1) {
        status = "warning";
        reason = `Elevated in-process error rate (${(errorRate * 100).toFixed(0)}%).`;
      }

      return withDiagnostics(
        resultBase(this, {
          status,
          latencyMs: metrics.avgLatencyMs,
          message: `${name} · ${metrics.requests} req · avg ${metrics.avgLatencyMs ?? "—"} ms`,
          lastSuccessAt: metrics.lastSuccessAt,
          lastFailureAt: metrics.lastFailureAt,
          lastFailure: metrics.lastFailure,
          meta: { configured: true, ...metrics, errorRate, model: modelHint },
          score: scoreFromStatus(status),
        }),
        {
          reason,
          suggestedAction:
            status === "healthy"
              ? "No action required."
              : `Inspect ${name} API status, quotas, and recent application AI errors.`,
          technicalDetails: {
            provider: name,
            model: modelHint,
            apiReachable: status !== "critical",
            configured: true,
            averageLatencyMs: metrics.avgLatencyMs,
            lastSuccessfulRequest: metrics.lastSuccessAt,
            lastFailure: metrics.lastFailureAt,
            lastFailureMessage: metrics.lastFailure,
            requests: metrics.requests,
            errors: metrics.errors,
            errorRate,
            estimatedCostUsd: metrics.estimatedCostUsd,
          },
        },
      );
    },
  };
}

export const openAiProvider = envConfiguredProvider(
  "openai",
  "OpenAI",
  ["OPENAI_API_KEY"],
  process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini (default / env OPENAI_MODEL)",
);

export const anthropicProvider = envConfiguredProvider(
  "anthropic",
  "Anthropic",
  ["ANTHROPIC_API_KEY"],
  process.env.ANTHROPIC_MODEL?.trim() || "claude (env ANTHROPIC_MODEL)",
);

export const geminiProvider = envConfiguredProvider(
  "gemini",
  "Google Gemini",
  ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
  process.env.GEMINI_MODEL?.trim() || "gemini (env GEMINI_MODEL)",
);
