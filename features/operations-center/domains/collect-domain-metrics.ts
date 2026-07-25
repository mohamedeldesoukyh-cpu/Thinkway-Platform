import type { SupabaseClient } from "@supabase/supabase-js";

import { getBuildInfo } from "@/lib/deploy/build-info";

import { getSecurityMetrics } from "../metrics/security-metrics-store";
import type {
  ComponentStatus,
  DomainMetricCard,
  HealthCheckResult,
  QueueMonitorRow,
} from "../types";

function card(
  id: string,
  label: string,
  value: string | number,
  status: ComponentStatus = "healthy",
  hint?: string,
  extras?: Partial<
    Pick<
      DomainMetricCard,
      "reason" | "suggestedAction" | "technicalDetails" | "checkedAt"
    >
  >,
): DomainMetricCard {
  return {
    id,
    label,
    value,
    status,
    hint,
    checkedAt: extras?.checkedAt ?? new Date().toISOString(),
    ...extras,
  };
}

async function countTable(
  supabase: SupabaseClient,
  table: string,
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

async function latestTimestamp(
  supabase: SupabaseClient,
  table: string,
  column: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as Record<string, unknown>;
    const value = row[column];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export async function collectAuthMetrics(
  supabase: SupabaseClient,
): Promise<DomainMetricCard[]> {
  const security = getSecurityMetrics();
  const sessions = await countTable(supabase, "profiles");
  return [
    card(
      "failed-logins",
      "Failed logins",
      security.failedLogins,
      security.failedLogins > 20 ? "warning" : "healthy",
      "Process counters",
      {
        reason:
          security.failedLogins > 20
            ? "Failed login volume exceeded warning threshold (>20)."
            : "Failed login volume within tolerance.",
      },
    ),
    card("successful-logins", "Successful logins", security.successfulLogins),
    card(
      "mfa-failures",
      "MFA failures",
      security.mfaFailures,
      security.mfaFailures > 5 ? "warning" : "healthy",
    ),
    card("oauth-failures", "OAuth failures", security.oauthFailures),
    card("password-resets", "Password resets", security.passwordResets),
    card(
      "invite-failures",
      "Invite failures",
      security.inviteFailures,
      security.inviteFailures > 0 ? "warning" : "healthy",
    ),
    card(
      "active-sessions",
      "Profiles (proxy for accounts)",
      sessions ?? "—",
      sessions == null ? "unknown" : "healthy",
      "Auth session store not exposed; profile count as proxy",
    ),
  ];
}

export async function collectDiscoveryMetrics(
  supabase: SupabaseClient,
  queues: QueueMonitorRow[],
): Promise<DomainMetricCard[]> {
  const creators = await countTable(supabase, "influencers");
  const dnaCount = await countTable(supabase, "creator_dna");
  const lastEnrichment = await latestTimestamp(
    supabase,
    "creator_enrichment_runs",
    "created_at",
  );
  const lastImport = await latestTimestamp(
    supabase,
    "creator_import_files",
    "created_at",
  );

  const enrichmentActive = queues
    .filter((q) => q.name.includes("enrichment") && !q.name.includes("dlq"))
    .reduce((s, q) => s + q.active, 0);
  const enrichmentPending = queues
    .filter((q) => q.name.includes("enrichment") && !q.name.includes("dlq"))
    .reduce((s, q) => s + q.waiting + q.delayed, 0);
  const importFailed = queues
    .filter((q) => q.name.includes("import"))
    .reduce((s, q) => s + q.failed, 0);
  const discoveryWaiting = queues
    .filter((q) => q.name.startsWith("discovery"))
    .reduce((s, q) => s + q.waiting + q.active, 0);
  const discoveryFailed = queues
    .filter((q) => q.name.startsWith("discovery") || q.name.includes("enrichment"))
    .reduce((s, q) => s + q.failed, 0);

  let dnaCoverage: string | number = "—";
  let dnaStatus: ComponentStatus = "unknown";
  if (creators != null && creators > 0 && dnaCount != null) {
    dnaCoverage = `${Math.round((dnaCount / creators) * 100)}% (${dnaCount})`;
    dnaStatus = dnaCount / creators < 0.3 ? "warning" : "healthy";
  } else if (dnaCount != null) {
    dnaCoverage = dnaCount;
    dnaStatus = "healthy";
  }

  const queueHealth: ComponentStatus =
    discoveryFailed > 25 ? "warning" : discoveryFailed > 0 ? "warning" : "healthy";

  return [
    card(
      "creator-count",
      "Creator count",
      creators ?? "—",
      creators == null ? "unknown" : "healthy",
      undefined,
      {
        reason:
          creators == null
            ? "Could not query influencers (permissions or connectivity)."
            : `${creators} creators in influencers.`,
      },
    ),
    card("dna-count", "DNA count", dnaCount ?? "—", dnaStatus, undefined, {
      reason:
        dnaCount == null
          ? "Could not query creator_dna."
          : `${dnaCount} Creator DNA rows.`,
    }),
    card("dna-coverage", "DNA coverage", dnaCoverage, dnaStatus),
    card(
      "last-enrichment",
      "Last enrichment",
      lastEnrichment ? new Date(lastEnrichment).toLocaleString() : "—",
      lastEnrichment ? "healthy" : "unknown",
    ),
    card(
      "last-import",
      "Last import",
      lastImport ? new Date(lastImport).toLocaleString() : "—",
      lastImport ? "healthy" : "unknown",
    ),
    card(
      "queue-health",
      "Queue health",
      discoveryFailed > 0 ? `${discoveryFailed} failed` : "OK",
      queueHealth,
      undefined,
      {
        reason:
          discoveryFailed > 0
            ? `Discovery/enrichment queues report ${discoveryFailed} failed jobs.`
            : "No failed discovery/enrichment jobs in retention window.",
        suggestedAction:
          discoveryFailed > 0
            ? "Open the Queues tab and inspect failed enrichment/import jobs."
            : "No action required.",
        technicalDetails: {
          enrichmentActive,
          enrichmentPending,
          discoveryWaiting,
          discoveryFailed,
          importFailed,
        },
      },
    ),
    card("active-enrichments", "Active enrichments", enrichmentActive),
    card(
      "pending-enrichments",
      "Pending enrichments",
      enrichmentPending,
      enrichmentPending > 100 ? "warning" : "healthy",
    ),
    card("failed-imports", "Failed imports", importFailed, importFailed > 0 ? "warning" : "healthy"),
  ];
}

export async function collectFinanceMetrics(
  supabase: SupabaseClient,
  queues: QueueMonitorRow[],
): Promise<DomainMetricCard[]> {
  const started = performance.now();
  const invoices = await countTable(supabase, "invoices");
  const latencyMs = Math.round(performance.now() - started);
  const latestInvoice = await latestTimestamp(supabase, "invoices", "created_at");

  let approvalQueue: number | null = null;
  try {
    const { count } = await supabase
      .from("approvals")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_review", "submitted"]);
    approvalQueue = count;
  } catch {
    approvalQueue = null;
  }

  const pendingJobs = queues
    .filter((q) => q.name.includes("finance") || q.name.includes("invoice"))
    .reduce((s, q) => s + q.waiting + q.active + q.delayed, 0);

  const dbStatus: ComponentStatus =
    invoices == null ? "critical" : latencyMs > 1500 ? "warning" : "healthy";

  return [
    card(
      "database-reachable",
      "Database reachable",
      invoices == null ? "No" : `Yes · ${latencyMs} ms`,
      dbStatus,
      undefined,
      {
        reason:
          invoices == null
            ? "Finance tables could not be queried."
            : "Finance database probe succeeded via invoices count.",
        suggestedAction:
          invoices == null
            ? "Check Supabase connectivity and finance table RLS for this role."
            : "No action required.",
        technicalDetails: { latencyMs, invoices },
      },
    ),
    card(
      "latest-invoice",
      "Latest invoice generated",
      latestInvoice ? new Date(latestInvoice).toLocaleString() : "—",
      latestInvoice ? "healthy" : "unknown",
    ),
    card(
      "invoice-queue",
      "Invoices (total)",
      invoices ?? "—",
      invoices == null ? "unknown" : "healthy",
    ),
    card(
      "pending-jobs",
      "Pending jobs",
      pendingJobs,
      pendingJobs > 50 ? "warning" : "healthy",
      "Finance-named queues only",
    ),
    card(
      "background-workers",
      "Background workers",
      "See Worker card",
      "unknown",
      "Finance shares the discovery-worker / Redis worker plane",
      {
        reason:
          "No dedicated finance worker heartbeat; use the Worker and Queues panels.",
      },
    ),
    card(
      "approval-queue",
      "Approval queue",
      approvalQueue ?? "—",
      approvalQueue == null ? "unknown" : approvalQueue > 50 ? "warning" : "healthy",
    ),
  ];
}

export function collectStorageDomainMetrics(
  storageComponent: HealthCheckResult | undefined,
): DomainMetricCard[] {
  const meta = storageComponent?.meta ?? {};
  const details = storageComponent?.technicalDetails ?? {};
  const status = storageComponent?.status ?? "unknown";
  const bucketCount =
    (meta.bucketCount as number | undefined) ??
    (details.bucketCount as number | undefined) ??
    "—";
  const objectSample =
    (meta.objectCountSample as number | undefined) ??
    (details.objectCountSample as number | undefined) ??
    "—";
  const largest = (details.largestBucket as { id?: string; sampleCount?: number } | null) ??
    (meta.largestBucket as { id?: string; sampleCount?: number } | null);
  const lastUpload =
    (details.lastUpload as string | null | undefined) ??
    (meta.lastUpload as string | null | undefined);

  return [
    card("bucket-count", "Bucket count", bucketCount, status, undefined, {
      reason: storageComponent?.reason,
      suggestedAction: storageComponent?.suggestedAction,
      technicalDetails: details,
    }),
    card(
      "object-count",
      "Object count (sample)",
      objectSample,
      status,
      typeof details.objectCountNote === "string" ? details.objectCountNote : undefined,
    ),
    card(
      "total-storage-size",
      "Total storage size",
      typeof details.totalStorageSize === "string"
        ? details.totalStorageSize
        : "—",
      "unknown",
    ),
    card(
      "largest-bucket",
      "Largest bucket (sample)",
      largest?.id
        ? `${largest.id} (${largest.sampleCount ?? 0})`
        : "—",
      largest?.id ? "healthy" : "unknown",
    ),
    card(
      "last-upload",
      "Last upload (sample)",
      lastUpload ? new Date(lastUpload).toLocaleString() : "—",
      lastUpload ? "healthy" : "unknown",
    ),
    card(
      "storage-probe",
      "Storage probe",
      storageComponent?.latencyMs != null
        ? `${storageComponent.latencyMs} ms`
        : status,
      status,
      storageComponent?.message,
      {
        reason: storageComponent?.reason,
        suggestedAction: storageComponent?.suggestedAction,
      },
    ),
  ];
}

export function collectApiDomainMetrics(
  nextJs: HealthCheckResult | undefined,
): DomainMetricCard[] {
  const build = getBuildInfo();
  return [
    card(
      "api-version",
      "API version",
      build.gitShaShort ?? build.app,
      "healthy",
      undefined,
      {
        reason: "API version derived from deployment git SHA / app identity.",
        technicalDetails: {
          app: build.app,
          gitSha: build.gitSha,
          environment: build.environment,
        },
      },
    ),
    card(
      "avg-response-time",
      "Average response time",
      "—",
      "unknown",
      undefined,
      {
        reason:
          "Not instrumented — no in-process HTTP latency aggregator is wired to Operations Center yet.",
        suggestedAction:
          "Wire APM / middleware histograms (or Vercel Analytics) into this card.",
      },
    ),
    card(
      "slowest-endpoint",
      "Slowest endpoint",
      "—",
      "unknown",
      undefined,
      {
        reason: "Not instrumented — slowest-route tracking is not collected in-app.",
        suggestedAction: "Enable route-level timing middleware or external APM.",
      },
    ),
    card(
      "error-rate-24h",
      "Error rate (24h)",
      "—",
      "unknown",
      undefined,
      {
        reason: "Not instrumented — 24h API error rate is not aggregated in-process.",
        suggestedAction: "Connect log drain / APM error rate into Operations Center.",
      },
    ),
    card(
      "nextjs-probe",
      "Next.js probe",
      nextJs?.latencyMs != null ? `${nextJs.latencyMs} ms` : nextJs?.status ?? "—",
      nextJs?.status ?? "unknown",
      nextJs?.message,
      {
        reason: nextJs?.reason,
        suggestedAction: nextJs?.suggestedAction,
      },
    ),
  ];
}

export function collectSecurityDomainMetrics(): DomainMetricCard[] {
  const m = getSecurityMetrics();
  return [
    card("sec-failed-logins", "Failed logins", m.failedLogins, m.failedLogins > 20 ? "warning" : "healthy"),
    card("permission-denials", "Permission denials", m.permissionDenials),
    card("rate-limit-events", "Rate limit events", m.rateLimitEvents, m.rateLimitEvents > 50 ? "warning" : "healthy"),
    card("blocked-requests", "Blocked requests", m.blockedRequests),
    card("csrf-failures", "CSRF failures", m.csrfFailures, m.csrfFailures > 0 ? "warning" : "healthy"),
    card("ssrf-blocks", "SSRF blocks", m.ssrfBlocks),
    card("xss-sanitizations", "XSS sanitizations", m.xssSanitizations),
    card("audit-events", "Audit events", m.auditEvents),
  ];
}
