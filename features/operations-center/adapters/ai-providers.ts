import type { HealthProvider } from "./types";
import { resultBase } from "./types";
import { getAiProviderMetrics } from "../metrics/ai-metrics-store";

function envConfiguredProvider(
  id: string,
  name: string,
  envKeys: string[],
): HealthProvider {
  return {
    id,
    name,
    kind: "ai",
    weight: 1,
    async check() {
      const configured = envKeys.some((key) => Boolean(process.env[key]?.trim()));
      const metrics = getAiProviderMetrics(id);
      if (!configured) {
        return resultBase(this, {
          status: "unknown",
          latencyMs: null,
          message: `${name} API key not configured.`,
          meta: { configured: false, ...metrics },
        });
      }
      const errorRate = metrics.requests > 0 ? metrics.errors / metrics.requests : 0;
      let status: import("../types").ComponentStatus = "healthy";
      if (metrics.lastFailureAt && Date.now() - Date.parse(metrics.lastFailureAt) < 15 * 60_000) {
        status = errorRate > 0.25 ? "critical" : "warning";
      } else if (errorRate > 0.1) {
        status = "warning";
      }
      return resultBase(this, {
        status,
        latencyMs: metrics.avgLatencyMs,
        message: configured
          ? `${name} configured · ${metrics.requests} req · ~$${metrics.estimatedCostUsd.toFixed(2)}`
          : `${name} not configured`,
        lastSuccessAt: metrics.lastSuccessAt,
        lastFailureAt: metrics.lastFailureAt,
        lastFailure: metrics.lastFailure,
        meta: { configured: true, ...metrics, errorRate },
      });
    },
  };
}

export const openAiProvider = envConfiguredProvider("openai", "OpenAI", [
  "OPENAI_API_KEY",
]);

export const anthropicProvider = envConfiguredProvider("anthropic", "Anthropic", [
  "ANTHROPIC_API_KEY",
]);

export const geminiProvider = envConfiguredProvider("gemini", "Google Gemini", [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
]);
