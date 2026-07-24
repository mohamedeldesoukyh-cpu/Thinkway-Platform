/** Operations Center shared types (P5). */

export const COMPONENT_STATUSES = [
  "healthy",
  "warning",
  "critical",
  "offline",
  "unknown",
] as const;

export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];

export const ALERT_LEVELS = ["info", "warning", "critical"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const LOG_CATEGORIES = [
  "application",
  "workers",
  "security",
  "ai",
  "finance",
  "discovery",
  "operations",
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const LOG_SEVERITIES = ["debug", "info", "warn", "error"] as const;
export type LogSeverity = (typeof LOG_SEVERITIES)[number];

export type ProviderKind =
  | "infrastructure"
  | "queue"
  | "ai"
  | "integration"
  | "storage"
  | "auth"
  | "domain";

export type HealthCheckResult = {
  id: string;
  name: string;
  kind: ProviderKind;
  status: ComponentStatus;
  latencyMs: number | null;
  checkedAt: string;
  /** 0–100 component contribution before weighting */
  score: number;
  message?: string;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastFailure?: string | null;
  meta?: Record<string, unknown>;
};

export type WeightedComponent = {
  id: string;
  weight: number;
  status: ComponentStatus;
  score: number;
};

export type HealthEngineReport = {
  overallHealthScore: number;
  overallStatus: ComponentStatus;
  checkedAt: string;
  components: HealthCheckResult[];
};

export type QueueMonitorRow = {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  retries: number;
  deadLetter: number;
  available: boolean;
  oldestWaitingAgeMs: number | null;
  longestRunningAgeMs: number | null;
  throughputHint: string;
  error?: string;
};

export type AlertRecord = {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  source: string;
  createdAt: string;
  acknowledged?: boolean;
};

export type DependencyNode = {
  id: string;
  label: string;
  status: ComponentStatus;
  latencyMs: number | null;
  dependsOn: string[];
  lastFailure: string | null;
};

export type DependencyGraph = {
  nodes: DependencyNode[];
  edges: Array<{ from: string; to: string }>;
};

export type OpsLogEntry = {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  category: LogCategory;
  source: string;
  message: string;
  fields?: Record<string, unknown>;
};

export type DomainMetricCard = {
  id: string;
  label: string;
  value: string | number;
  status: ComponentStatus;
  hint?: string;
};

export type OperationsCenterSnapshot = {
  generatedAt: string;
  health: HealthEngineReport;
  queues: QueueMonitorRow[];
  queueTotals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    deadLetter: number;
  };
  alerts: AlertRecord[];
  dependencyGraph: DependencyGraph;
  logs: OpsLogEntry[];
  domains: {
    infrastructure: HealthCheckResult[];
    ai: HealthCheckResult[];
    integrations: HealthCheckResult[];
    auth: DomainMetricCard[];
    discovery: DomainMetricCard[];
    finance: DomainMetricCard[];
    storage: DomainMetricCard[];
    security: DomainMetricCard[];
  };
  worker: {
    alive: boolean;
    stale: boolean;
    ageMs: number | null;
    error?: string;
  };
};
