import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import type { DiscoveryDiagnosticsSnapshot } from "@/features/discovery/control-center/queries";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "default" : "secondary"} className={ok ? "bg-[#1D9E75] hover:bg-[#1D9E75]/90" : ""}>
      {label}
    </Badge>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/10 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function DiscoveryDiagnosticsSection({
  snapshot,
}: {
  snapshot: DiscoveryDiagnosticsSnapshot;
}) {
  const { settings, queue, apify, database, jobs, coverageDecisions } = snapshot;

  return (
    <div className="grid gap-6">
      <OperationalFormSection
        title="Discovery mode"
        description="Active policy from Discovery Control Center (singleton settings row)."
      >
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Source mode
            </dt>
            <dd className="text-sm font-medium">{settings.discoverySource}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Search priority
            </dt>
            <dd className="text-sm font-medium">{settings.searchPriority}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Coverage threshold
            </dt>
            <dd className="text-sm font-medium">{settings.coverageThreshold}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Auto enrichment
            </dt>
            <dd className="text-sm font-medium">{settings.automaticEnrichment}</dd>
          </div>
        </dl>
      </OperationalFormSection>

      <OperationalFormSection
        title="Infrastructure"
        description="Queue, worker, and Apify connectivity probes."
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge ok={queue.redisConfigured} label={queue.redisConfigured ? "Redis connected" : "Redis not configured"} />
          <StatusBadge
            ok={queue.redisConfigured}
            label={queue.redisConfigured ? "Worker path available" : "Worker not available"}
          />
          <StatusBadge ok={apify.tokenConfigured} label={apify.tokenConfigured ? "Apify token set" : "Apify token missing"} />
          <StatusBadge ok={apify.fallbackEnabled} label={apify.fallbackEnabled ? "Apify fallback enabled" : "Apify fallback disabled"} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{queue.hint}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Apify requests today
            </dt>
            <dd className="text-sm">{apify.requestsUsedToday}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Apify credits today
            </dt>
            <dd className="text-sm">{apify.creditsUsedToday}</dd>
          </div>
        </dl>
      </OperationalFormSection>

      <OperationalFormSection title="Creator database" description="Operational counts for discovery health.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Active influencers" value={String(database.activeInfluencers)} />
          <MetricCard label="Discovered profiles (unlinked)" value={String(database.discoveredProfiles)} />
          <MetricCard label="Creators with DNA" value={String(database.creatorsWithDna)} />
          <MetricCard
            label="DNA completeness avg"
            value={database.dnaCompletenessAverage != null ? `${database.dnaCompletenessAverage}%` : "—"}
          />
          <MetricCard label="Missing DNA" value={String(database.missingDna)} />
          <MetricCard label="Pending discovery jobs" value={String(database.pendingDiscoveryJobs)} />
        </div>
      </OperationalFormSection>

      <OperationalFormSection title="Recent jobs" description="Last discovery job and enrichment placeholder.">
        <dl className="grid gap-3">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Last discovery job
            </dt>
            <dd className="text-sm text-foreground">
              {jobs.lastDiscoveryJob
                ? `${String(jobs.lastDiscoveryJob.job_type ?? "job")} · ${String(jobs.lastDiscoveryJob.status ?? "unknown")} · ${String(jobs.lastDiscoveryJob.created_at ?? "")}`
                : "No discovery jobs recorded"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Last enrichment
            </dt>
            <dd className="text-sm text-muted-foreground">
              {jobs.lastEnrichmentJob
                ? JSON.stringify(jobs.lastEnrichmentJob)
                : "Enrichment job history not wired — use creator-enrichment queue stats (placeholder)."}
            </dd>
          </div>
        </dl>
      </OperationalFormSection>

      <OperationalFormSection
        title="Coverage decision history"
        description="Last 20 rows from discovery_coverage_decisions audit table."
      >
        {coverageDecisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No coverage decisions recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>DB count</TableHead>
                <TableHead>Apify</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverageDecisions.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>{row.coverage_score}</TableCell>
                  <TableCell>{row.coverage_level}</TableCell>
                  <TableCell>{row.database_creators_count}</TableCell>
                  <TableCell>{row.apify_executed ? "Yes" : "No"}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs">{row.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </OperationalFormSection>
    </div>
  );
}
