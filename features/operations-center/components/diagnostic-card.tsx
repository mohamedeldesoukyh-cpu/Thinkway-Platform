"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import type {
  ComponentStatus,
  DomainMetricCard,
  HealthCheckResult,
  LatencyThresholds,
} from "../types";
import { ComponentStatusBadge } from "./status-badge";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium tabular-nums">
        {value}
      </span>
    </div>
  );
}

function formatThresholds(thresholds?: LatencyThresholds) {
  if (!thresholds) return null;
  return (
    <div className="space-y-1 rounded-md bg-muted/40 px-2.5 py-2">
      <DetailRow label="Healthy" value={`<${thresholds.warningMs} ms`} />
      <DetailRow
        label="Warning"
        value={`${thresholds.warningMs}–${thresholds.criticalMs} ms`}
      />
      <DetailRow label="Critical" value={`>${thresholds.criticalMs} ms`} />
    </div>
  );
}

function needsExplanation(status: ComponentStatus) {
  return (
    status === "warning" ||
    status === "critical" ||
    status === "offline" ||
    status === "expected"
  );
}

export function HealthDiagnosticCard({ item }: { item: HealthCheckResult }) {
  const details = item.technicalDetails ?? item.meta ?? {};
  const showDiag = needsExplanation(item.status);
  // Latency probes always show current value + bands when thresholds exist
  const showLatencyPanel = item.thresholds != null || item.latencyMs != null;

  return (
    <div className="rounded-lg border border-border/70 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.message}</p>
        </div>
        <ComponentStatusBadge status={item.status} />
      </div>

      {(showDiag || showLatencyPanel) && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {item.reason ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {item.status === "expected"
                  ? "Expected in Local Development"
                  : "Reason"}
              </p>
              <p className="mt-0.5 text-xs">{item.reason}</p>
            </div>
          ) : null}

          {item.latencyMs != null ? (
            <DetailRow label="Current latency" value={`${item.latencyMs} ms`} />
          ) : null}

          {details.host != null ? (
            <DetailRow label="Host" value={String(details.host)} />
          ) : null}
          {details.port != null ? (
            <DetailRow label="Port" value={String(details.port)} />
          ) : null}
          {details.redactedUrl != null ? (
            <DetailRow label="URL" value={String(details.redactedUrl)} />
          ) : null}
          {details.envVar != null ? (
            <DetailRow label="Env var" value={String(details.envVar)} />
          ) : null}
          {typeof details.hasAuth === "boolean" ? (
            <DetailRow
              label="Auth configured"
              value={details.hasAuth ? "yes" : "no"}
            />
          ) : null}
          {typeof details.authenticationSucceeded === "boolean" ? (
            <DetailRow
              label="Auth / ping"
              value={
                details.authenticationSucceeded ? "succeeded" : "failed"
              }
            />
          ) : null}
          {details.suggestedFix != null ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Suggested fix
              </p>
              <p className="mt-0.5 text-xs">{String(details.suggestedFix)}</p>
            </div>
          ) : null}

          {formatThresholds(item.thresholds)}

          {showDiag || details.lastSuccessfulPing || item.lastSuccessAt ? (
            <DetailRow
              label="Last successful ping"
              value={
                details.lastSuccessfulPing || item.lastSuccessAt
                  ? new Date(
                      String(details.lastSuccessfulPing ?? item.lastSuccessAt),
                    ).toLocaleString()
                  : "—"
              }
            />
          ) : null}

          {showDiag &&
          (details.lastFailedPing || item.lastFailureAt || item.lastFailure) ? (
            <DetailRow
              label="Last failed ping"
              value={
                details.lastFailedPing
                  ? new Date(String(details.lastFailedPing)).toLocaleString()
                  : item.lastFailureAt
                    ? new Date(item.lastFailureAt).toLocaleString()
                    : "—"
              }
            />
          ) : null}

          {showDiag && item.suggestedAction ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Suggested action
              </p>
              <p className="mt-0.5 text-xs">{item.suggestedAction}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>Checked {new Date(item.checkedAt).toLocaleString()}</span>
            {item.logsUrl ? (
              <Link
                href={item.logsUrl}
                className="underline-offset-2 hover:underline"
              >
                View logs
              </Link>
            ) : null}
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/50 p-2 text-[10px] leading-relaxed">
              {JSON.stringify(
                {
                  status: item.status,
                  score: item.score,
                  latencyMs: item.latencyMs,
                  lastFailure: item.lastFailure,
                  ...details,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

export function MetricDiagnosticCard({ card }: { card: DomainMetricCard }) {
  const explain = needsExplanation(card.status) || Boolean(card.reason);
  return (
    <div className="rounded-lg border border-border/70 bg-card/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{card.label}</p>
        <ComponentStatusBadge status={card.status} />
      </div>
      <p className="mt-1 text-lg font-semibold tracking-tight">{card.value}</p>
      {card.hint ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{card.hint}</p>
      ) : null}
      {explain ? (
        <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
          {card.reason ? (
            <p className="text-[11px]">
              <span className="text-muted-foreground">Reason: </span>
              {card.reason}
            </p>
          ) : null}
          {card.suggestedAction ? (
            <p className="text-[11px]">
              <span className="text-muted-foreground">Action: </span>
              {card.suggestedAction}
            </p>
          ) : null}
          {card.technicalDetails ? (
            <details className="text-[11px]">
              <summary className="cursor-pointer text-muted-foreground">
                Technical details
              </summary>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-[10px]">
                {JSON.stringify(card.technicalDetails, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
