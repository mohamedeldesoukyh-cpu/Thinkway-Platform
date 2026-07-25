import type { HealthCheckResult, ProviderKind } from "../types";

export type HealthProviderContext = {
  /** Optional Supabase user-scoped client for DB probes */
  supabase?: import("@supabase/supabase-js").SupabaseClient;
  signal?: AbortSignal;
};

/**
 * Extensible monitoring adapter. Register new providers without changing
 * the Operations Center shell — only the registry.
 */
export interface HealthProvider {
  readonly id: string;
  readonly name: string;
  readonly kind: ProviderKind;
  /** Relative weight for overallHealthScore (default 1). */
  readonly weight?: number;
  check(ctx: HealthProviderContext): Promise<HealthCheckResult>;
}

export function statusFromLatency(
  latencyMs: number | null,
  opts?: { warnMs?: number; criticalMs?: number; offline?: boolean },
): import("../types").ComponentStatus {
  if (opts?.offline) return "offline";
  if (latencyMs == null) return "unknown";
  const warn = opts?.warnMs ?? 800;
  const critical = opts?.criticalMs ?? 2500;
  if (latencyMs >= critical) return "critical";
  if (latencyMs >= warn) return "warning";
  return "healthy";
}

export function scoreFromStatus(
  status: import("../types").ComponentStatus,
): number {
  switch (status) {
    case "healthy":
    case "expected":
      return 100;
    case "warning":
      return 70;
    case "critical":
      return 35;
    case "offline":
      return 0;
    case "unknown":
    default:
      return 50;
  }
}

export function resultBase(
  provider: Pick<HealthProvider, "id" | "name" | "kind">,
  partial: Omit<HealthCheckResult, "id" | "name" | "kind" | "checkedAt" | "score"> & {
    score?: number;
    checkedAt?: string;
  },
): HealthCheckResult {
  const status = partial.status;
  return {
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    checkedAt: partial.checkedAt ?? new Date().toISOString(),
    score: partial.score ?? scoreFromStatus(status),
    ...partial,
    status,
  };
}
