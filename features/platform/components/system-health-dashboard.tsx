"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  HealthCheck,
  HealthCheckStatus,
  HealthSection,
  PlatformHealthReport,
} from "@/lib/platform/health/types";

const SECTION_LABELS: Record<HealthSection, string> = {
  database: "Database connectivity",
  migrations: "Migrations",
  analytics: "Analytics engine",
  billing: "Billing engine",
  planning: "Planning engine",
  invoices: "Invoice engine",
  operational: "Operational queue",
  permissions: "Permissions / RLS",
  cache: "Cache status",
};

const STATUS_VARIANT: Record<
  HealthCheckStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ok: "default",
  warning: "secondary",
  error: "destructive",
  skipped: "outline",
};

function StatusBadge({ status }: { status: HealthCheckStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="text-[10px] uppercase">
      {status}
    </Badge>
  );
}

type SystemHealthDashboardProps = {
  report: PlatformHealthReport;
};

export function SystemHealthDashboard({ report }: SystemHealthDashboardProps) {
  const sections = [...new Set(report.checks.map((c) => c.section))];

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            Platform health
            <StatusBadge status={report.overall} />
          </CardTitle>
          <CardDescription>
            Generated {new Date(report.generated_at).toLocaleString()} — operational ERP
            paths are isolated from optional enrichment failures.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => {
          const checks = report.checks.filter((c) => c.section === section);
          return (
            <Card key={section} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {SECTION_LABELS[section]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {checks.map((check) => (
                  <HealthCheckRow key={check.id} check={check} />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function HealthCheckRow({ check }: { check: HealthCheck }) {
  return (
    <div className="rounded-2xl border border-border px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{check.label}</p>
        <StatusBadge status={check.status} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{check.message}</p>
      {check.hint ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{check.hint}</p>
      ) : null}
      <p className="mt-1 text-[10px] text-muted-foreground">{check.durationMs}ms</p>
    </div>
  );
}
