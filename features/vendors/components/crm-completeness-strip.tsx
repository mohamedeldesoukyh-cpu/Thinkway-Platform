"use client";

import type { CompletenessBreakdown } from "@/lib/creators/crm/completeness";
import type { CreatorCrmProfileRow } from "@/types/database";
import { cn } from "@/lib/utils";

function Dim({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[13px] font-semibold tabular-nums text-foreground">{value}%</p>
    </div>
  );
}

export function CrmCompletenessStrip({
  profile,
  completeness,
}: {
  profile: CreatorCrmProfileRow | null;
  completeness: CompletenessBreakdown | null;
}) {
  if (!profile && !completeness) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2.5 text-[12px] text-muted-foreground">
        Not in Commercial CRM yet. Use From Discovery or New Creator to add this identity.
      </div>
    );
  }

  const dims = completeness?.dimensions;
  const missing = completeness?.missing ?? [];

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Profile completeness (informational)
          </p>
          <p className="text-[13px] font-semibold capitalize text-foreground">
            {(profile?.crm_status ?? "incomplete").replace(/_/g, " ")}
            {profile?.onboarding_source ? (
              <span className="ml-2 font-normal text-muted-foreground">
                · source {profile.onboarding_source.replace(/_/g, " ")}
              </span>
            ) : null}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Overall</p>
          <p
            className={cn(
              "text-lg font-semibold tabular-nums",
              (completeness?.overall ?? 0) >= 80
                ? "text-[var(--brand-product)]"
                : "text-foreground"
            )}
          >
            {completeness?.overall ?? Math.round(profile?.completeness_score ?? 0)}%
          </p>
        </div>
      </div>

      {dims ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Dim label="Identity" value={dims.identity} />
          <Dim label="Commercial" value={dims.commercial} />
          <Dim label="Legal" value={dims.legal} />
          <Dim label="Finance" value={dims.finance} />
          <Dim label="Client compliance" value={dims.client_compliance} />
        </div>
      ) : null}

      {missing.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {missing.slice(0, 8).map((item) => (
            <span
              key={item.code}
              className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-200"
            >
              Missing {item.label.replace(/^Missing /i, "")}
            </span>
          ))}
          {missing.length > 8 ? (
            <span className="text-[11px] text-muted-foreground">
              +{missing.length - 8} more
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
