"use client";

import { useMemo, useState } from "react";
import { CheckIcon, PencilIcon, SparklesIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { DirectorRecommendation, DirectorConfidence } from "../director/director-types";

const CONFIDENCE_STYLE: Record<DirectorConfidence, string> = {
  High: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Low: "border-border bg-muted/40 text-muted-foreground",
};

export type DirectorRecommendationsPanelProps = {
  summary: string;
  recommendations: DirectorRecommendation[];
  /** Apply reuses the existing Copilot mutation + versioning. */
  onApply?: (command: string) => void;
};

/**
 * Surfaces the AI Campaign Director's recommendations inside the Studio. Reuses
 * the existing deterministic recommendation engine (passed in as data). Apply
 * dispatches the recommendation's proposedCommand through the existing Copilot,
 * so the mutation + versioning path is never duplicated. Modify edits the
 * command inline before applying; Dismiss is local.
 */
export function DirectorRecommendationsPanel({
  summary,
  recommendations,
  onApply,
}: DirectorRecommendationsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Record<string, string>>({});
  const visible = useMemo(
    () => recommendations.filter((rec) => !dismissed.has(rec.id)),
    [recommendations, dismissed]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
          <SparklesIcon className="size-4 text-white" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-foreground">AI Campaign Director</h2>
          <p className="text-[11px] text-muted-foreground">{summary}</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/20 p-4 text-[13px] text-muted-foreground">
          No open recommendations — the campaign looks well-balanced.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((rec) => (
            <div key={rec.id} className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground">{rec.title}</h3>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    CONFIDENCE_STYLE[rec.confidence]
                  )}
                >
                  {rec.confidence}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">{rec.recommendation}</p>
              <p className="mt-2 text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground/80">Reason:</span> {rec.reason}
              </p>
              {rec.evidence.length ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/70">Evidence:</span> {rec.evidence.join("; ")}
                </p>
              ) : null}

              {rec.proposedCommand && editing[rec.id] !== undefined ? (
                <input
                  type="text"
                  value={editing[rec.id]}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [rec.id]: e.target.value }))}
                  className="mt-3 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] text-foreground focus:border-[#1D9E75] focus:outline-none"
                  aria-label="Edit the command before applying"
                />
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {rec.proposedCommand ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onApply?.(editing[rec.id] ?? rec.proposedCommand!)}
                      disabled={!onApply}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#1D9E75] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#178a66] disabled:opacity-40"
                    >
                      <CheckIcon className="size-3.5" /> Apply
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing((prev) =>
                          rec.id in prev
                            ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== rec.id))
                            : { ...prev, [rec.id]: rec.proposedCommand! }
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:bg-muted/60"
                    >
                      <PencilIcon className="size-3.5" /> {editing[rec.id] !== undefined ? "Cancel" : "Modify"}
                    </button>
                  </>
                ) : (
                  <span className="rounded-md border border-border/70 px-2 py-1 text-[10px] text-muted-foreground">
                    Advisory — reflected when outputs regenerate
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setDismissed((prev) => new Set(prev).add(rec.id))}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60"
                >
                  <XIcon className="size-3.5" /> Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
