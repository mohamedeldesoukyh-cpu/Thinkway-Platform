export {
  devLog,
  warnLog,
  errorLog,
  performanceLog,
  startTimer,
} from "@/lib/platform/logger";

export {
  hasTable,
  hasColumn,
  isMissingColumnError,
  isMissingTableError,
  isRelationshipError,
  isRlsError,
  classifyQueryError,
  safeSelect,
  KNOWN_TABLES,
  KNOWN_COLUMNS,
} from "@/lib/platform/schema-validation";

export {
  safeServerQuery,
  safeAnalyticsQuery,
  safePlanningQuery,
  safeOperationalQuery,
  type SafeQueryResult,
  type SafeQueryErrorCode,
} from "@/lib/platform/safe-query";

export {
  useStableMemo,
  shouldSkipStateUpdate,
} from "@/lib/platform/performance";

export { runPlatformHealthChecks } from "@/lib/platform/health/run-health";
export type {
  PlatformHealthReport,
  HealthCheck,
  HealthCheckStatus,
  HealthSection,
} from "@/lib/platform/health/types";
