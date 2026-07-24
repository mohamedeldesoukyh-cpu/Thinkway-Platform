"use client";

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
} from "../types";
import { AlertLevelBadge, ComponentStatusBadge } from "./status-badge";

function MetricGrid({ cards }: { cards: DomainMetricCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.id}
          className="rounded-lg border border-border/70 bg-card/40 px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <ComponentStatusBadge status={card.status} />
          </div>
          <p className="mt-1 text-lg font-semibold tracking-tight">{card.value}</p>
          {card.hint ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{card.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ProviderGrid({ items }: { items: HealthCheckResult[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border border-border/70 px-3 py-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.message}</p>
            </div>
            <ComponentStatusBadge status={item.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>Latency: {item.latencyMs != null ? `${item.latencyMs}ms` : "—"}</span>
            <span>Checked: {new Date(item.checkedAt).toLocaleTimeString()}</span>
            {item.lastFailure ? <span>Last failure: {item.lastFailure}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OperationsCenterDashboard({
  snapshot,
}: {
  snapshot: OperationsCenterSnapshot;
}) {
  const { health, queues, queueTotals, alerts, dependencyGraph, logs, domains, worker } =
    snapshot;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              Overall health
              <ComponentStatusBadge status={health.overallStatus} />
            </CardTitle>
            <CardDescription>
              Generated {new Date(snapshot.generatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tracking-tight">
              {health.overallHealthScore}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                / 100
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Weighted score across {health.components.length} adapters
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Worker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span>Heartbeat</span>
              <ComponentStatusBadge
                status={
                  !worker.alive ? "offline" : worker.stale ? "warning" : "healthy"
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Age: {worker.ageMs != null ? `${Math.round(worker.ageMs / 1000)}s` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Queues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Waiting <strong>{queueTotals.waiting}</strong> · Active{" "}
              <strong>{queueTotals.active}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Failed {queueTotals.failed} · DLQ {queueTotals.deadLetter}
            </p>
          </CardContent>
        </Card>
      </div>

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
                Next.js, Vercel, Supabase, Redis, BullMQ, Storage, Realtime
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
                Waiting · Active · Completed · Failed · Retries · Dead-letter
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-2 font-medium">Queue</th>
                    <th className="py-2 pr-2">Wait</th>
                    <th className="py-2 pr-2">Active</th>
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
                  <div
                    key={node.id}
                    className="rounded-lg border px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{node.label}</p>
                      <ComponentStatusBadge status={node.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Depends on:{" "}
                      {node.dependsOn.length
                        ? node.dependsOn.join(", ")
                        : "—"}
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
          href="/system/performance"
          className="underline-offset-2 hover:underline"
        >
          Performance governance
        </Link>
      </div>
    </div>
  );
}
