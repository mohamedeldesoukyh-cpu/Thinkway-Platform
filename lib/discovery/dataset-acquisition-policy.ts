/**
 * Sprint 3 — dataset acquisition feature gates.
 * Legacy worker / inline username paths remain when disabled (production default).
 */

const TRUTHY = new Set(["true", "1", "yes", "on"]);

function envFlag(name: string): string | undefined {
  return process.env[name]?.trim().toLowerCase();
}

function envTruthy(name: string, defaultValue: boolean): boolean {
  const value = envFlag(name);
  if (value === undefined || value === "") return defaultValue;
  if (TRUTHY.has(value)) return true;
  if (value === "false" || value === "0" || value === "no" || value === "off") return false;
  return defaultValue;
}

/** When true, coverage backfill uses dataset import orchestrator instead of legacy paths. */
export function isDatasetAcquisitionBackfillEnabled(): boolean {
  return envTruthy("DATASET_ACQUISITION_BACKFILL", false);
}

/** Staging — record legacy vs dataset acquisition outcomes on discovery_jobs.result. */
export function isDatasetAcquisitionCompareModeEnabled(): boolean {
  return envTruthy("DATASET_ACQUISITION_COMPARE", false);
}
