"use client";

import { cn } from "@/lib/utils";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import { INSUFFICIENT_EVIDENCE } from "@/features/campaign-studio/services/eci/recommendation-narrative";
import {
  pickStrategyCompareFinal,
  toExecutiveCreatorCardView,
} from "@/features/campaign-studio/services/eci/executive-planning-view";

export type StudioPlanningCompareColumn = {
  id: string;
  displayName: string;
  handle?: string;
  signal: StudioEciPlanningSignal | null;
};

type Row = {
  label: string;
  values: string[];
};

function cellFromNarrative(
  signal: StudioEciPlanningSignal | null,
  displayName: string,
  pick: (view: ReturnType<typeof toExecutiveCreatorCardView>) => string
): string {
  if (!signal) return INSUFFICIENT_EVIDENCE;
  const view = toExecutiveCreatorCardView(signal, displayName);
  const value = pick(view).trim();
  return value || INSUFFICIENT_EVIDENCE;
}

/**
 * Strategy Compare — campaign decision perspective (not Discovery Compare).
 * Rows follow the canonical decision narrative order.
 */
export function StudioPlanningCompareMatrix({
  columns,
  onOpenCreator,
}: {
  columns: StudioPlanningCompareColumn[];
  onOpenCreator?: (id: string) => void;
}) {
  const finalPick = pickStrategyCompareFinal(columns);

  const rows: Row[] = [
    {
      label: "Recommendation",
      values: columns.map((c) =>
        cellFromNarrative(c.signal, c.displayName, (v) =>
          `${v.narrative.what}${c.id === finalPick.winnerId ? " · Final pick" : ""}`
        )
      ),
    },
    {
      label: "Why",
      values: columns.map((c) =>
        cellFromNarrative(c.signal, c.displayName, (v) => v.narrative.whyBest)
      ),
    },
    {
      label: "Evidence",
      values: columns.map((c) =>
        cellFromNarrative(c.signal, c.displayName, (v) => v.narrative.evidence)
      ),
    },
    {
      label: "Business value",
      values: columns.map((c) =>
        cellFromNarrative(c.signal, c.displayName, (v) => v.narrative.businessObjective)
      ),
    },
    {
      label: "Commercial value",
      values: columns.map((c) =>
        cellFromNarrative(c.signal, c.displayName, (v) => v.narrative.commercialValue)
      ),
    },
    {
      label: "Risk",
      values: columns.map((c) =>
        cellFromNarrative(c.signal, c.displayName, (v) => v.narrative.risks)
      ),
    },
    {
      label: "Alternative",
      values: columns.map((c) =>
        cellFromNarrative(
          c.signal,
          c.displayName,
          (v) =>
            `${v.narrative.alternativeConsidered} — ${v.narrative.whyAlternativeNotSelected}`
        )
      ),
    },
    {
      label: "Trade-offs",
      values: columns.map((c) =>
        cellFromNarrative(c.signal, c.displayName, (v) => v.narrative.alternatives.tradeOffs)
      ),
    },
    {
      label: "Decision impact",
      values: columns.map((c) =>
        cellFromNarrative(c.signal, c.displayName, (v) => v.narrative.decisionImpactSummary)
      ),
    },
    {
      label: "Confidence",
      values: columns.map((c) =>
        cellFromNarrative(c.signal, c.displayName, (v) => v.narrative.confidenceStatement)
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {finalPick.winnerName ? (
        <div className="shrink-0 border-b border-[#0057FF]/20 bg-[#0057FF]/5 px-4 py-3 text-[12px] sm:px-5">
          <p className="font-extrabold text-[#0057FF]">Final Recommendation</p>
          <p className="mt-1 text-foreground">
            <b>{finalPick.winnerName}</b> — {finalPick.why}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Planning confidence: {finalPick.confidence}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Decision transparency — not scenario planning. Alternatives and trade-offs are
            compared below.
          </p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead className="sticky top-0 z-10 bg-[#f8fafc] dark:bg-background">
            <tr>
              <th className="sticky left-0 z-20 min-w-[150px] border-b border-r border-border bg-[#f8fafc] px-3 py-2.5 text-left font-semibold dark:bg-background">
                Strategy lens
              </th>
              {columns.map((col) => {
                const view = col.signal
                  ? toExecutiveCreatorCardView(col.signal, col.displayName)
                  : null;
                return (
                  <th
                    key={col.id}
                    className="min-w-[200px] border-b border-border px-3 py-2.5 text-left font-semibold"
                  >
                    <button
                      type="button"
                      className={cn(
                        "text-left",
                        onOpenCreator && "hover:text-[#0057FF] hover:underline"
                      )}
                      onClick={() => onOpenCreator?.(col.id)}
                    >
                      {col.displayName}
                    </button>
                    {col.handle ? (
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {col.handle}
                      </div>
                    ) : null}
                    {view ? (
                      <div
                        className={cn(
                          "mt-1 text-[10px] font-extrabold",
                          view.decision === "Recommended" ? "text-emerald-700" : "text-red-700"
                        )}
                      >
                        {view.decision}
                      </div>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="align-top">
                <th className="sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">
                  {row.label}
                </th>
                {row.values.map((value, i) => (
                  <td
                    key={`${row.label}-${columns[i]?.id}`}
                    className="border-b border-border px-3 py-2.5 text-foreground"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
