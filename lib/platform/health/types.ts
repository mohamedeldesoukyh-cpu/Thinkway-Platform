export type HealthCheckStatus = "ok" | "warning" | "error" | "skipped";

export type HealthCheck = {
  id: string;
  section: HealthSection;
  label: string;
  status: HealthCheckStatus;
  message: string;
  hint?: string;
  durationMs: number;
};

export type HealthSection =
  | "database"
  | "migrations"
  | "analytics"
  | "billing"
  | "planning"
  | "invoices"
  | "operational"
  | "permissions"
  | "cache";

export type PlatformHealthReport = {
  generated_at: string;
  overall: HealthCheckStatus;
  checks: HealthCheck[];
};

export function worstStatus(checks: HealthCheck[]): HealthCheckStatus {
  if (checks.some((c) => c.status === "error")) return "error";
  if (checks.some((c) => c.status === "warning")) return "warning";
  if (checks.every((c) => c.status === "skipped")) return "skipped";
  return "ok";
}
