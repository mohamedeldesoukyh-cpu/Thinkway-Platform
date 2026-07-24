/**
 * Static production-readiness inventory used by `npm run test:production`.
 * Does not call live production — certifies repository controls & artifacts.
 */

export const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "REDIS_URL",
  "OPENAI_API_KEY",
] as const;

export const REQUIRED_MIGRATIONS = [
  "20260724150000_finance_fx_rls_least_privilege.sql",
  "20260724160000_finance_po_notifications_rls_hardening.sql",
  "20260724170000_invalidate_plaintext_invites.sql",
  "20260724180000_p4_campaign_publication_media_select.sql",
] as const;

export const REQUIRED_SECURITY_MODULES = [
  "lib/security/workspace-auth.ts",
  "lib/security/workspace-classification-registry.ts",
  "lib/security/ai-workspace-isolation.ts",
  "lib/security/request-guard.ts",
  "lib/security/security-headers.ts",
  "lib/security/csrf.ts",
  "lib/security/rate-limit.ts",
  "lib/security/ssrf.ts",
  "lib/security/sanitize-html.ts",
  "lib/supabase/admin.ts",
  "lib/auth/mfa.ts",
] as const;

export const REQUIRED_OPERATIONS_MODULES = [
  "features/operations-center/health/engine.ts",
  "features/operations-center/alerts/engine.ts",
  "features/operations-center/adapters/registry.ts",
  "features/operations-center/services/build-snapshot.ts",
  "app/(dashboard)/operations/page.tsx",
  "app/api/operations-center/snapshot/route.ts",
] as const;

export const HANDOVER_DOCUMENTS = [
  "01_EXECUTIVE_OVERVIEW.md",
  "02_SYSTEM_ARCHITECTURE.md",
  "03_INFRASTRUCTURE.md",
  "04_DATABASE_SCHEMA.md",
  "05_AUTHENTICATION_AUTHORIZATION.md",
  "06_SECURITY_ARCHITECTURE.md",
  "07_WORKSPACE_AND_TENANT_ISOLATION.md",
  "08_DISCOVERY_ENGINE.md",
  "09_AI_ARCHITECTURE.md",
  "10_FINANCE_MODULE.md",
  "11_OPERATIONS_CENTER.md",
  "12_DEPLOYMENT_GUIDE.md",
  "13_ENVIRONMENT_VARIABLES.md",
  "14_BACKUP_AND_RECOVERY.md",
  "15_MONITORING_AND_ALERTS.md",
  "16_EXTERNAL_INTEGRATIONS.md",
  "17_BACKGROUND_WORKERS.md",
  "18_STORAGE_ARCHITECTURE.md",
  "19_API_REFERENCE.md",
  "20_TROUBLESHOOTING.md",
  "21_RUNBOOK.md",
  "22_INCIDENT_RESPONSE.md",
  "23_KNOWN_LIMITATIONS.md",
  "24_GO_LIVE_CHECKLIST.md",
  "25_POST_GO_LIVE_OPERATIONS.md",
  "DIAGRAMS.md",
  "GO_LIVE_CERTIFICATION.md",
] as const;

export type ReadinessDimension =
  | "security"
  | "architecture"
  | "operations"
  | "recovery"
  | "performance"
  | "maintainability"
  | "supportability";

/** Certification scores used in GO_LIVE_CERTIFICATION.md (0–100). */
export const CERTIFICATION_SCORES: Record<ReadinessDimension, number> = {
  security: 86,
  architecture: 88,
  operations: 84,
  recovery: 72,
  performance: 78,
  maintainability: 90,
  supportability: 85,
};

export function overallCertificationScore(
  scores: Record<ReadinessDimension, number> = CERTIFICATION_SCORES,
): number {
  const values = Object.values(scores);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export type GoLiveDecision = "GO" | "CONDITIONAL_GO" | "NO_GO";

export function deriveGoLiveDecision(overall: number): GoLiveDecision {
  if (overall >= 90) return "GO";
  if (overall >= 75) return "CONDITIONAL_GO";
  return "NO_GO";
}
