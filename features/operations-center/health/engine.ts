import {
  ensureDefaultHealthProviders,
  listHealthProviders,
} from "../adapters/registry";
import type { HealthProviderContext } from "../adapters/types";
import type {
  ComponentStatus,
  HealthCheckResult,
  HealthEngineReport,
} from "../types";
import { buildScoreBreakdown, statusFromScore } from "./score";
import {
  suggestedActionForStatus,
  defaultLogsUrl,
} from "./diagnostics";

export async function runHealthEngine(
  ctx: HealthProviderContext = {},
): Promise<HealthEngineReport> {
  ensureDefaultHealthProviders();
  const providers = listHealthProviders();
  const components = await Promise.all(
    providers.map(async (provider) => {
      try {
        const result = await provider.check(ctx);
        return {
          ...result,
          reason: result.reason ?? result.message ?? `${result.status}`,
          suggestedAction:
            result.suggestedAction ??
            suggestedActionForStatus(result.status, result.id),
          logsUrl: result.logsUrl ?? defaultLogsUrl(result.id),
        } satisfies HealthCheckResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          id: provider.id,
          name: provider.name,
          kind: provider.kind,
          status: "critical" as const,
          latencyMs: null,
          checkedAt: new Date().toISOString(),
          score: 0,
          message,
          reason: `Health probe threw: ${message}`,
          suggestedAction: suggestedActionForStatus("critical", provider.id),
          logsUrl: defaultLogsUrl(provider.id),
          lastFailure: message,
          lastFailureAt: new Date().toISOString(),
          technicalDetails: { error: message },
        } satisfies HealthCheckResult;
      }
    }),
  );

  const weighted = components.map((component) => {
    const provider = providers.find((p) => p.id === component.id);
    return {
      id: component.id,
      name: component.name,
      weight: provider?.weight ?? 1,
      status: component.status,
      score: component.score,
    };
  });

  const { breakdown, totalWeight, overall } = buildScoreBreakdown(weighted);
  const overallStatus = deriveOverallStatus(components, overall);

  return {
    overallHealthScore: overall,
    overallStatus,
    checkedAt: new Date().toISOString(),
    components,
    scoreBreakdown: breakdown,
    totalWeight,
  };
}

export function deriveOverallStatus(
  components: HealthCheckResult[],
  score: number,
): ComponentStatus {
  if (components.some((c) => c.status === "offline")) return "offline";
  if (components.some((c) => c.status === "critical")) return "critical";
  if (components.some((c) => c.status === "warning")) {
    return score < 60 ? "critical" : "warning";
  }
  return statusFromScore(score);
}
