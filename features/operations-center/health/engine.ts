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
import { calculateOverallHealthScore, statusFromScore } from "./score";

export async function runHealthEngine(
  ctx: HealthProviderContext = {},
): Promise<HealthEngineReport> {
  ensureDefaultHealthProviders();
  const providers = listHealthProviders();
  const components = await Promise.all(
    providers.map(async (provider) => {
      try {
        return await provider.check(ctx);
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
          lastFailure: message,
          lastFailureAt: new Date().toISOString(),
        } satisfies HealthCheckResult;
      }
    }),
  );

  const weighted = components.map((component) => {
    const provider = providers.find((p) => p.id === component.id);
    return {
      id: component.id,
      weight: provider?.weight ?? 1,
      status: component.status,
      score: component.score,
    };
  });

  const overallHealthScore = calculateOverallHealthScore(weighted);
  const overallStatus = deriveOverallStatus(components, overallHealthScore);

  return {
    overallHealthScore,
    overallStatus,
    checkedAt: new Date().toISOString(),
    components,
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
