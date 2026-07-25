"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  DomainMetricCard,
  HealthCheckResult,
  OperationsCenterSnapshot,
  ReleaseReadinessCheckStatus,
  ScoreContribution,
} from "../types";
import {
  HealthDiagnosticCard,
  MetricDiagnosticCard,
} from "./diagnostic-card";
import { AlertLevelBadge, ComponentStatusBadge } from "./status-badge";

const READINESS_STATUS_CLASS: Record<ReleaseReadinessCheckStatus, string> = {
  pass: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  fail: "bg-red-600/15 text-red-700 dark:text-red-400",
  expected_local: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  manual: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

function MetricGrid({ cards }: { cards: DomainMetricCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <MetricDiagnosticCard key={card.id} card={card} />
      ))}
    </div>
  );
}

function ProviderGrid({ items }: { items: HealthCheckResult[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <HealthDiagnosticCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function contributionLabel(row: ScoreContribution) {
  const sign = row.contribution >= 0 ? "+" : "";
  return `${sign}${row.contribution}`;
}

function InfoGrid({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-md border border-border/60 px-3 py-2"
        >
          <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
          <dd className="mt-0.5 break-all text-sm font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OperationsCenterDashboard({
  snapshot,
}: {
  snapshot: OperationsCenterSnapshot;
}) {
  const {
    health,
    deployment,
    releaseReadiness,
    runtimeMode,
    queues,
    queueTotals,
    alerts,
    dependencyGraph,
    logs,
    domains,
    worker,
  } = snapshot;

  const supabaseComponent = health.components.find((c) => c.id === "supabase");
  const redisComponent = health.components.find((c) => c.id === "redis");
  const isLocal = runtimeMode === "local";

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            Release Readiness
            <Badge
              variant="outline"
              className={
                releaseReadiness.readyForProduction
                  ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-600/15 text-red-700 dark:text-red-400"
              }
            >
              Ready for Production:{" "}
              {releaseReadiness.readyForProduction ? "YES" : "NO"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Runtime: {runtimeMode}
            {isLocal
              ? " — local gaps marked Expected do not fail this environment’s health score."
              : " — missing infrastructure is treated as a real issue."}{" "}
            {releaseReadiness.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {releaseReadiness.checks.map((check) => (
              <div
                key={check.id}
                className="rounded-md border border-border/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{check.label}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase ${READINESS_STATUS_CLASS[check.status]}`}
                  >
                    {check.status === "expected_local"
                      ? "expected"
                      : check.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {check.detail}
                </p>
              </div>
            ))}
          </div>
          {!releaseReadiness.readyForProduction &&
          releaseReadiness.blockers.length > 0 ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
              <p className="text-xs font-medium text-red-700 dark:text-red-400">
                Blocking production deploy
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {releaseReadiness.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              Overall health
              <ComponentStatusBadge status={health.overallStatus} />
            </CardTitle>
            <CardDescription>
              Generated {new Date(snapshot.generatedAt).toLocaleString()}
              {isLocal ? " · Local development" : " · Deployed runtime"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-semibold tracking-tight">
              {health.overallHealthScore}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                / 100
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Weighted average: round(Σ score × weight / Σ weight). Status map:
              healthy/expected=100, warning=70, critical=35, unknown=50,
              offline=0. Total weight {health.totalWeight.toFixed(1)}.
            </p>
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-md border border-border/60 p-2">
              {health.scoreBreakdown.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Weight {row.weight} · score {row.score}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ComponentStatusBadge status={row.status} />
                    <span className="w-12 text-right font-semibold tabular-nums">
                      {contributionLabel(row)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t px-2 pt-2 text-xs font-semibold">
                <span>Total</span>
                <span>
                  {health.overallHealthScore} / 100
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Queue workers</CardTitle>
            <CardDescription>
              {worker.expectation === "optional_local"
                ? "Optional in local development unless you process discovery jobs."
                : "Required in this environment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Heartbeat</span>
              <ComponentStatusBadge status={worker.status} />
            </div>
            <p className="text-xs text-muted-foreground">{worker.reason}</p>
            <div className="space-y-1 text-xs">
              <Detail
                label="Expected"
                value={
                  worker.expectedProcesses.map((p) => p.label).join(", ") || "—"
                }
              />
              <Detail
                label="Running"
                value={
                  worker.runningProcesses.length > 0
                    ? worker.runningProcesses.join(", ")
                    : "none"
                }
              />
              <Detail
                label="Missing"
                value={
                  worker.missingProcesses.length > 0
                    ? worker.missingProcesses.join(", ")
                    : "none"
                }
              />
              {worker.expectedProcesses.map((proc) => (
                <Detail
                  key={proc.id}
                  label={`Start ${proc.id}`}
                  value={proc.startCommand}
                />
              ))}
              <Detail label="Worker version" value={worker.version ?? "—"} />
              <Detail
                label="Last heartbeat"
                value={
                  worker.lastHeartbeat
                    ? new Date(worker.lastHeartbeat).toLocaleString()
                    : "—"
                }
              />
              <Detail
                label="Uptime"
                value={
                  worker.uptimeMs != null
                    ? `${Math.round(worker.uptimeMs / 1000)}s`
                    : "—"
                }
              />
              <Detail
                label="Last completed job"
                value={worker.lastCompletedJob ?? "Not instrumented"}
              />
              <Detail
                label="Last failed job"
                value={worker.lastFailedJob ?? "Not instrumented"}
              />
            </div>
            {needsExplain(worker.status) || worker.status === "expected" ? (
              <p className="text-[11px] text-muted-foreground">
                Action: {worker.suggestedAction}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">BullMQ totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <Detail label="Waiting" value={queueTotals.waiting} />
            <Detail label="Active" value={queueTotals.active} />
            <Detail label="Delayed" value={queueTotals.delayed} />
            <Detail label="Completed" value={queueTotals.completed} />
            <Detail label="Failed" value={queueTotals.failed} />
            <Detail label="Retry jobs" value={queueTotals.retries} />
            <Detail label="Worker count" value={queueTotals.workerCount} />
            <Detail label="Dead-letter" value={queueTotals.deadLetter} />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Deployment information</CardTitle>
          <CardDescription>
            {isLocal
              ? "Local development — missing Vercel deployment metadata is expected. Highlight only genuine misconfiguration."
              : "Verify this runtime is the intended production deployment and Supabase project."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Application
            </h3>
            <InfoGrid
              rows={[
                { label: "Environment", value: deployment.application.environment },
                {
                  label: "Git commit SHA",
                  value: deployment.application.gitCommitSha ?? "—",
                },
                {
                  label: "Git branch",
                  value: deployment.application.gitBranch ?? "—",
                },
                {
                  label: "Build timestamp",
                  value: new Date(
                    deployment.application.buildTimestamp,
                  ).toLocaleString(),
                },
                {
                  label: "Build number / deployment id",
                  value: deployment.application.buildNumber ?? "—",
                },
                {
                  label: "Deployed by",
                  value: deployment.application.deployedBy ?? "—",
                },
              ]}
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vercel
            </h3>
            <InfoGrid
              rows={[
                {
                  label: "Deployment ID",
                  value: deployment.vercel.deploymentId ?? "—",
                },
                {
                  label: "Deployment URL",
                  value: deployment.vercel.deploymentUrl ?? "—",
                },
                {
                  label: "Deployment status",
                  value: deployment.vercel.deploymentStatus ?? "—",
                },
              ]}
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Supabase
            </h3>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ComponentStatusBadge
                status={supabaseComponent?.status ?? "unknown"}
              />
              {deployment.supabase.alignedWithExpected === false ? (
                <Badge variant="destructive">Project ref mismatch</Badge>
              ) : deployment.supabase.alignedWithExpected ? (
                <Badge variant="secondary">Expected project</Badge>
              ) : null}
            </div>
            <InfoGrid
              rows={[
                {
                  label: "Connected project reference",
                  value: deployment.supabase.projectRef ?? "—",
                },
                {
                  label: "Expected project reference",
                  value: deployment.supabase.expectedProjectRef ?? "—",
                },
                {
                  label: "Project URL",
                  value: deployment.supabase.projectUrl ?? "—",
                },
                {
                  label: "Region",
                  value:
                    deployment.supabase.region ??
                    "Set SUPABASE_REGION (e.g. eu-central-1)",
                },
                {
                  label: "PostgreSQL version",
                  value:
                    deployment.supabase.postgresVersion ??
                    "Set SUPABASE_POSTGRES_VERSION to display",
                },
                {
                  label: "Database reachable",
                  value:
                    supabaseComponent?.technicalDetails?.databaseReachable ===
                    true
                      ? "Yes"
                      : supabaseComponent?.status === "healthy" ||
                          supabaseComponent?.status === "warning"
                        ? "Yes"
                        : "No / unknown",
                },
                {
                  label: "Connection latency",
                  value:
                    supabaseComponent?.latencyMs != null
                      ? `${supabaseComponent.latencyMs} ms`
                      : "—",
                },
              ]}
            />
            {redisComponent ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Redis probe: {redisComponent.status}
                {redisComponent.latencyMs != null
                  ? ` · ${redisComponent.latencyMs} ms`
                  : ""}
                {redisComponent.reason ? ` — ${redisComponent.reason}` : ""}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {alerts.length > 0 ? (
        <Card className="shadow-sm border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active alerts</CardTitle>
            <CardDescription>{alerts.length} open</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleString()} · {alert.source}
                  </p>
                </div>
                <AlertLevelBadge level={alert.level} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="infrastructure" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="auth">Auth</TabsTrigger>
          <TabsTrigger value="discovery">Discovery</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="graph">Dependencies</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="infrastructure">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Infrastructure</CardTitle>
              <CardDescription>
                Every Warning / Critical / Offline card includes reason, thresholds,
                suggested action, and expandable technical details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProviderGrid items={domains.infrastructure} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">BullMQ</CardTitle>
              <CardDescription>
                Waiting · Active · Delayed · Completed · Failed · Retries · Dead-letter
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-2 font-medium">Queue</th>
                    <th className="py-2 pr-2">Wait</th>
                    <th className="py-2 pr-2">Active</th>
                    <th className="py-2 pr-2">Delayed</th>
                    <th className="py-2 pr-2">Done</th>
                    <th className="py-2 pr-2">Fail</th>
                    <th className="py-2 pr-2">Retry</th>
                    <th className="py-2 pr-2">DLQ</th>
                    <th className="py-2 pr-2">Oldest wait</th>
                    <th className="py-2">Longest run</th>
                  </tr>
                </thead>
                <tbody>
                  {queues.map((q) => (
                    <tr key={q.name} className="border-b border-border/50">
                      <td className="py-2 pr-2 font-medium">{q.name}</td>
                      <td className="py-2 pr-2">{q.waiting}</td>
                      <td className="py-2 pr-2">{q.active}</td>
                      <td className="py-2 pr-2">{q.delayed}</td>
                      <td className="py-2 pr-2">{q.completed}</td>
                      <td className="py-2 pr-2">{q.failed}</td>
                      <td className="py-2 pr-2">{q.retries}</td>
                      <td className="py-2 pr-2">{q.deadLetter}</td>
                      <td className="py-2 pr-2">
                        {q.oldestWaitingAgeMs != null
                          ? `${Math.round(q.oldestWaitingAgeMs / 1000)}s`
                          : "—"}
                      </td>
                      <td className="py-2">
                        {q.longestRunningAgeMs != null
                          ? `${Math.round(q.longestRunningAgeMs / 1000)}s`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API</CardTitle>
              <CardDescription>
                Deployment identity and HTTP telemetry gaps (explicit when not instrumented).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetricGrid cards={domains.api} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI providers</CardTitle>
            </CardHeader>
            <CardContent>
              <ProviderGrid items={domains.ai} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Third-party integrations</CardTitle>
              <CardDescription>
                Email and OAuth adapters report exact configuration reasons (not “Unknown” alone).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProviderGrid items={domains.integrations} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Authentication monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricGrid cards={domains.auth} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discovery">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discovery monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricGrid cards={domains.discovery} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Finance monitoring</CardTitle>
              <CardDescription>Internal only</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricGrid cards={domains.finance} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Storage monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricGrid cards={domains.storage} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricGrid cards={domains.security} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dependency graph</CardTitle>
              <CardDescription>
                Users → Next.js → API → Supabase / Redis / BullMQ / Storage / AI / Email /
                Discovery / Finance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {dependencyGraph.nodes.map((node) => (
                  <div key={node.id} className="rounded-lg border px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{node.label}</p>
                      <ComponentStatusBadge status={node.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Depends on:{" "}
                      {node.dependsOn.length ? node.dependsOn.join(", ") : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Latency:{" "}
                      {node.latencyMs != null ? `${node.latencyMs}ms` : "—"}
                    </p>
                    {node.lastFailure ? (
                      <p className="text-[11px] text-red-600 dark:text-red-400">
                        {node.lastFailure}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unified logs</CardTitle>
              <CardDescription>
                Categories: Application · Workers · Security · AI · Finance · Discovery ·
                Operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No buffered ops logs yet. Snapshots and instrumented paths write here.
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium">{log.message}</p>
                      <p className="text-muted-foreground">
                        {log.source} · {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline">{log.category}</Badge>
                      <Badge variant="secondary">{log.severity}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Link href="/operations/move" className="underline-offset-2 hover:underline">
          Business ops: Move
        </Link>
        <Link
          href="/operations/reassignment"
          className="underline-offset-2 hover:underline"
        >
          Reassignment
        </Link>
        <Link href="/system/health" className="underline-offset-2 hover:underline">
          Legacy system health
        </Link>
        <Link
          href="/api/build-info"
          className="underline-offset-2 hover:underline"
        >
          /api/build-info
        </Link>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function needsExplain(status: string) {
  return (
    status === "warning" ||
    status === "critical" ||
    status === "offline" ||
    status === "expected"
  );
}
