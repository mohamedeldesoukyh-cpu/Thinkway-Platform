import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  budgetStatus,
  type BudgetCheckReport,
  type BudgetLimit,
  type PerformanceBaseline,
  type PerformanceBudgets,
  type PerformanceReport,
} from "@/lib/platform/performance-governance/load-governance";

type Props = {
  budgets: PerformanceBudgets | null;
  baseline: PerformanceBaseline | null;
  report: PerformanceReport | null;
  check: BudgetCheckReport | null;
  rumSlos: Record<string, unknown> | null;
  apiSlos: Record<string, unknown> | null;
  sqlSlos: Record<string, unknown> | null;
};

function StatusBadge({
  status,
}: {
  status: "pass" | "warn" | "fail" | "unknown";
}) {
  const variant =
    status === "pass"
      ? "default"
      : status === "warn"
        ? "secondary"
        : status === "fail"
          ? "destructive"
          : "outline";
  return (
    <Badge variant={variant} className="text-[10px] uppercase">
      {status}
    </Badge>
  );
}

function MetricRow({
  label,
  value,
  unit,
  limits,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  limits?: BudgetLimit;
}) {
  const status = budgetStatus(value, limits);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {limits ? (
          <p className="text-[11px] text-muted-foreground">
            soft {limits.soft}
            {unit} · hard {limits.hard}
            {unit}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums">
          {value == null ? "—" : `${value}${unit}`}
        </span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function fmtDelta(d: number | null | undefined, p: number | null | undefined) {
  if (d == null) return "—";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d} KB${p != null ? ` (${sign}${p}%)` : ""}`;
}

export function PerformanceGovernanceDashboard({
  budgets,
  baseline,
  report,
  check,
  rumSlos,
  apiSlos,
  sqlSlos,
}: Props) {
  const score = check?.score ?? null;
  const failCount = check?.results.fails.length ?? 0;
  const warnCount = check?.results.warns.length ?? 0;
  const overall =
    failCount > 0 ? "fail" : warnCount > 0 ? "warn" : report ? "pass" : "unknown";

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            Performance score
            <StatusBadge status={overall} />
          </CardTitle>
          <CardDescription>
            Budgeted platform governance — CI fails on hard limit breaches. Last
            report{" "}
            {report?.capturedAt
              ? new Date(report.capturedAt).toLocaleString()
              : "not generated yet (run npm run validate:performance after build)"}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="text-2xl font-semibold tabular-nums">
              {score == null ? "—" : `${score}/100`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hard fails</p>
            <p className="text-2xl font-semibold tabular-nums">{failCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Soft warnings</p>
            <p className="text-2xl font-semibold tabular-nums">{warnCount}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bundle budgets</CardTitle>
            <CardDescription>Production `.next/static` sizes</CardDescription>
          </CardHeader>
          <CardContent>
            <MetricRow
              label="Largest JS"
              value={report?.bundle.largestJsKb ?? baseline?.bundle.largestJsKb}
              unit=" KB"
              limits={budgets?.bundle.largestJsKb}
            />
            <MetricRow
              label="Largest CSS"
              value={report?.bundle.largestCssKb ?? baseline?.bundle.largestCssKb}
              unit=" KB"
              limits={budgets?.bundle.largestCssKb}
            />
            <MetricRow
              label="Total JS"
              value={report?.bundle.totalJsKb ?? baseline?.bundle.totalJsKb}
              unit=" KB"
              limits={budgets?.bundle.totalJsKb}
            />
            <MetricRow
              label="Total CSS"
              value={report?.bundle.totalCssKb ?? baseline?.bundle.totalCssKb}
              unit=" KB"
              limits={budgets?.bundle.totalCssKb}
            />
            <MetricRow
              label="Assets ≥100 KB"
              value={
                report?.bundle.assetsOver100kb ?? baseline?.bundle.assetsOver100kb
              }
              unit=""
              limits={budgets?.bundle.assetsOver100kb}
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bundle trend</CardTitle>
            <CardDescription>
              vs {report?.comparison?.against ?? "baseline"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Largest JS:{" "}
              <span className="tabular-nums">
                {fmtDelta(
                  report?.comparison?.largestJsKbDelta,
                  report?.comparison?.largestJsKbPct,
                )}
              </span>
            </p>
            <p>
              Largest CSS:{" "}
              <span className="tabular-nums">
                {fmtDelta(
                  report?.comparison?.largestCssKbDelta,
                  report?.comparison?.largestCssKbPct,
                )}
              </span>
            </p>
            <p>
              Total JS:{" "}
              <span className="tabular-nums">
                {fmtDelta(
                  report?.comparison?.totalJsKbDelta,
                  report?.comparison?.totalJsKbPct,
                )}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Baseline captured{" "}
              {baseline?.capturedAt
                ? new Date(baseline.capturedAt).toLocaleDateString()
                : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Source / route gate</CardTitle>
            <CardDescription>Client modules & root CSS chain</CardDescription>
          </CardHeader>
          <CardContent>
            <MetricRow
              label="Root globals CSS"
              value={
                report?.source.rootGlobalCssKb ?? baseline?.source.rootGlobalCssKb
              }
              unit=" KB"
              limits={budgets?.source.rootGlobalCssKb}
            />
            <MetricRow
              label="Client modules"
              value={
                report?.source.clientModuleCount ??
                baseline?.source.clientModuleCount
              }
              unit=""
              limits={budgets?.source.clientModuleCount}
            />
            <MetricRow
              label="Largest client source"
              value={
                report?.source.largestClientSourceKb ??
                baseline?.source.largestClientSourceKb
              }
              unit=" KB"
              limits={budgets?.source.largestClientSourceKb}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Tracked routes:{" "}
              {(budgets?.routes?.tracked ?? []).join(", ") || "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              API · SQL · Core Web Vitals
            </CardTitle>
            <CardDescription>
              SLO configs under <code>performance/monitoring/</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>RUM / Web Vitals</span>
              <StatusBadge
                status={
                  rumSlos &&
                  (rumSlos as { collection?: { status?: string } }).collection
                    ?.status === "planned"
                    ? "warn"
                    : rumSlos
                      ? "pass"
                      : "unknown"
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <span>API / RPC SLOs</span>
              <StatusBadge status={apiSlos ? "pass" : "unknown"} />
            </div>
            <div className="flex items-center justify-between">
              <span>SQL / index rules</span>
              <StatusBadge status={sqlSlos ? "pass" : "unknown"} />
            </div>
            <p className="text-xs text-muted-foreground">
              Live RUM wiring is gated (no product UI change). CI enforces bundle
              budgets; optional Discovery RPC + media-proxy harness when secrets
              exist.
            </p>
          </CardContent>
        </Card>
      </div>

      {check && (check.results.fails.length > 0 || check.results.warns.length > 0) ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Budget violations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...check.results.fails, ...check.results.warns].map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between gap-2 rounded-2xl border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    value {row.value} · soft {row.soft} · hard {row.hard}
                  </p>
                </div>
                <StatusBadge status={row.status as "fail" | "warn"} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report?.bundle.largestJs?.length ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Largest assets</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">JS</p>
              <ul className="space-y-1 text-xs">
                {report.bundle.largestJs.slice(0, 5).map((f) => (
                  <li key={f.file} className="truncate tabular-nums">
                    {f.kb} KB — {f.file}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">CSS</p>
              <ul className="space-y-1 text-xs">
                {report.bundle.largestCss.slice(0, 5).map((f) => (
                  <li key={f.file} className="truncate tabular-nums">
                    {f.kb} KB — {f.file}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
