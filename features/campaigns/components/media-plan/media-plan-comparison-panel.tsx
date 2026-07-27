"use client";

import type { MediaPlanDiffEntry } from "@/lib/media-plan";
import { cn } from "@/lib/utils";

const CHANGE_LABELS: Record<MediaPlanDiffEntry["changeType"], string> = {
  date_changed: "Date changed",
  creator_changed: "Creator changed",
  deliverable_changed: "Deliverable changed",
  platform_changed: "Platform changed",
  item_added: "Added",
  item_removed: "Removed",
};

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      [record.creatorName, record.deliverable, record.platform, record.plannedDate]
        .filter((part) => typeof part === "string" && part.trim())
        .join(" · ") || JSON.stringify(value)
    );
  }
  return String(value);
}

type MediaPlanComparisonPanelProps = {
  diffs: MediaPlanDiffEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baselineVersion: number | null;
  draftVersion: number | null;
};

export function MediaPlanComparisonPanel({
  diffs,
  open,
  onOpenChange,
  baselineVersion,
  draftVersion,
}: MediaPlanComparisonPanelProps) {
  if (!open) return null;

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Comparison Mode</h2>
          <p className="text-xs text-muted-foreground">
            Approved Baseline{baselineVersion != null ? ` v${baselineVersion}` : ""} vs Working
            Draft{draftVersion != null ? ` v${draftVersion}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => onOpenChange(false)}
        >
          Close
        </button>
      </div>

      {diffs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No differences between the approved baseline and the working draft.
        </p>
      ) : (
        <ul className="space-y-2">
          {diffs.map((diff, index) => (
            <li
              key={`${diff.changeType}-${diff.itemId ?? index}`}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                diff.changeType === "item_added" && "border-emerald-500/30 bg-emerald-500/5",
                diff.changeType === "item_removed" && "border-destructive/30 bg-destructive/5",
                !["item_added", "item_removed"].includes(diff.changeType) &&
                  "border-border bg-muted/30"
              )}
            >
              <div className="font-semibold">{CHANGE_LABELS[diff.changeType]}</div>
              <div className="mt-1 grid gap-1 text-muted-foreground sm:grid-cols-2">
                <div>
                  <span className="font-medium text-foreground/80">Before: </span>
                  {formatValue(diff.before)}
                </div>
                <div>
                  <span className="font-medium text-foreground/80">After: </span>
                  {formatValue(diff.after)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
