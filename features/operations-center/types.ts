/** Operations Center shared types (P5). */

export const COMPONENT_STATUSES = [
  "healthy",
  "expected",
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

export type LatencyThresholds = {
  /** Latency strictly below this is healthy (ms). */
  healthyMaxMs: number;
  /** Latency at/above this is warning (ms). */
  warningMs: number;
  /** Latency at/above this is critical (ms). */
  criticalMs: number;
};

export type HealthCheckResult = {
  id: string;
  name: string;
  kind: ProviderKind;
  status: ComponentStatus;
  latencyMs: number | null;
  checkedAt: string;
  /** 0–100 component score before weighting */
  score: number;
  message?: string;
  /** Human-readable explanation of the current status */
  reason?: string;
  /** What an engineer should do next */
  suggestedAction?: string;
  /** Link into Operations logs / related surface */
  logsUrl?: string;
  /** Latency bands when status is latency-derived */
  thresholds?: LatencyThresholds;
  /** Expandable structured probe output */
  technicalDetails?: Record<string, unknown>;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastFailure?: string | null;
  meta?: Record<string, unknown>;
};

export type WeightedComponent = {
  id: string;
  name?: string;
  weight: number;
  status: ComponentStatus;
  score: number;
};

export type ScoreContribution = {
  id: string;
  name: string;
  weight: number;
  status: ComponentStatus;
  score: number;
  /** score × weight (pre-normalization) */
  weightedPoints: number;
  /** Approximate points contributed to the 0–100 overall score */
  contribution: number;
};

export type HealthEngineReport = {
  overallHealthScore: number;
  overallStatus: ComponentStatus;
  checkedAt: string;
  components: HealthCheckResult[];
  /** Explainable score breakdown for the Overall Health card */
  scoreBreakdown: ScoreContribution[];
  totalWeight: number;
};

export type DeploymentInformation = {
  application: {
    environment: string;
    gitCommitSha: string | null;
    gitCommitShaShort: string | null;
    gitBranch: string | null;
    buildTimestamp: string;
    buildNumber: string | null;
    deployedBy: string | null;
  };
  vercel: {
    deploymentId: string | null;
    deploymentUrl: string | null;
    deploymentStatus: string | null;
    vercelEnv: string | null;
  };
  supabase: {
    projectRef: string | null;
    projectUrl: string | null;
    region: string | null;
    postgresVersion: string | null;
    expectedProjectRef: string | null;
    alignedWithExpected: boolean | null;
  };
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
  reason?: string;
  suggestedAction?: string;
  technicalDetails?: Record<string, unknown>;
  checkedAt?: string;
};

export type ExpectedWorkerProcess = {
  id: string;
  label: string;
  startCommand: string;
  required: boolean;
  running: boolean;
};

export type WorkerHealthSummary = {
  alive: boolean;
  stale: boolean;
  ageMs: number | null;
  error?: string;
  version: string | null;
  lastHeartbeat: string | null;
  lastCompletedJob: string | null;
  lastFailedJob: string | null;
  uptimeMs: number | null;
  queues: string[];
  status: ComponentStatus;
  reason: string;
  suggestedAction: string;
  /** Local vs production interpretation */
  expectation: "required" | "optional_local";
  expectedProcesses: ExpectedWorkerProcess[];
  runningProcesses: string[];
  missingProcesses: string[];
};

export type ReleaseReadinessCheckStatus =
  | "pass"
  | "fail"
  | "expected_local"
  | "manual";

export type ReleaseReadinessCheck = {
  id: string;
  label: string;
  status: ReleaseReadinessCheckStatus;
  detail: string;
  /** When true, Ready for Production is NO */
  blocksRelease: boolean;
};

export type ReleaseReadiness = {
  readyForProduction: boolean;
  runtimeMode: "local" | "production";
  summary: string;
  blockers: string[];
  checks: ReleaseReadinessCheck[];
};

export type OperationsCenterSnapshot = {
  generatedAt: string;
  health: HealthEngineReport;
  deployment: DeploymentInformation;
  releaseReadiness: ReleaseReadiness;
  runtimeMode: "local" | "production";
  queues: QueueMonitorRow[];
  queueTotals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    deadLetter: number;
    retries: number;
    workerCount: number;
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
    api: DomainMetricCard[];
  };
  worker: WorkerHealthSummary;
};
