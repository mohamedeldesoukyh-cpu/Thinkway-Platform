"use client";

import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";

type AssignmentsJsonFallbackProps = {
  hierarchy: AssignmentHierarchy;
  errorMessage?: string;
  digest?: string;
};

/** Emergency UI when Assignments tab render fails — never throws. */
export function AssignmentsJsonFallback({
  hierarchy,
  errorMessage,
  digest,
}: AssignmentsJsonFallbackProps) {
  const rows = (hierarchy.groups ?? []).map((g) => {
    const line = g?.line;
    return {
      line_id: line?.id ?? null,
      document_number: line?.document_number ?? null,
      name: line?.name ?? null,
      influencer: line?.influencer_name ?? null,
      operational_status: line?.operational_status ?? null,
      billing_status: line?.billing_status ?? null,
      revenue: line?.revenue ?? null,
      deliverables: Array.isArray(g.deliverables) ? g.deliverables.length : 0,
    };
  });

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
        Assignments emergency view
      </p>
      {errorMessage ? (
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
      ) : null}
      {digest ? (
        <p className="font-mono text-[10px] text-muted-foreground">Ref: {digest}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {rows.length} assignment line(s) loaded from the server. Full grid failed to render.
      </p>
      <pre className="max-h-80 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-[10px] leading-relaxed">
        {JSON.stringify(rows, null, 2)}
      </pre>
    </div>
  );
}
