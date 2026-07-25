import { isLocalDevelopmentRuntime } from "@/lib/observability/environment";

export const DISCOVERY_WORKER_PROCESS = {
  id: "discovery-worker",
  label: "Discovery worker",
  startCommandLocal: "npm run discovery:worker:dev",
  startCommandProduction: "npm run discovery:worker",
} as const;

export type OpsRuntimeMode = "local" | "production";

export function getOpsRuntimeMode(): OpsRuntimeMode {
  return isLocalDevelopmentRuntime() ? "local" : "production";
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
