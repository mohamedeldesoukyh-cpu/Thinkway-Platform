import { getDeploymentSurface } from "@/lib/deploy/deployment-environment";
import { isLocalDevelopmentRuntime } from "@/lib/observability/environment";

export const DISCOVERY_WORKER_PROCESS = {
  id: "discovery-worker",
  label: "Discovery worker",
  startCommandLocal: "npm run discovery:worker:dev",
  startCommandProduction: "npm run discovery:worker",
} as const;

/** Ops Center severity mode: local laptop vs hosted (dev or prod). */
export type OpsRuntimeMode = "local" | "production";

export function getOpsRuntimeMode(): OpsRuntimeMode {
  // Hosted Development is production-like for infra severity (Redis/worker matter).
  // Only the local laptop uses "expected in local development" softening.
  return isLocalDevelopmentRuntime() ? "local" : "production";
}

export function getOpsDeploymentLabel(): string {
  const surface = getDeploymentSurface();
  if (surface === "development") return "Development";
  if (surface === "production") return "Production";
  return "Local";
}

export function isOpsLocalRuntime(): boolean {
  return getOpsRuntimeMode() === "local";
}

/** Worker processes Operations Center expects for this runtime. */
export function expectedWorkerProcesses(mode: OpsRuntimeMode = getOpsRuntimeMode()) {
  return [
    {
      id: DISCOVERY_WORKER_PROCESS.id,
      label: DISCOVERY_WORKER_PROCESS.label,
      startCommand:
        mode === "local"
          ? DISCOVERY_WORKER_PROCESS.startCommandLocal
          : DISCOVERY_WORKER_PROCESS.startCommandProduction,
      /** Locally optional unless you are testing discovery jobs. */
      required: mode === "production",
    },
  ];
}

export function localExpectationMessage(topic: string): string {
  return `Expected in Local Development: ${topic}`;
}
