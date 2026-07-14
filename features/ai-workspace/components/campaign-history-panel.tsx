"use client";

import { useCallback, useState } from "react";
import { HistoryIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  listCampaignObjectVersionsAction,
  type CampaignVersionRow,
} from "@/features/campaign-studio/actions/campaign-version-actions";
import type { CopilotChangeLogEntry } from "@/features/campaign-intelligence/types/campaign-object";

type CampaignHistoryPanelProps = {
  campaignObjectId: string;
  changeLog: CopilotChangeLogEntry[];
  /** Restore sends a Copilot message so the studio re-renders through the normal flow. */
  onRestore?: (version: number) => void;
  disabled?: boolean;
};

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMin = Math.round((Date.now() - then) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

/** Change history + restore points for the campaign, shown in the studio panel. */
export function CampaignHistoryPanel({
  campaignObjectId,
  changeLog,
  onRestore,
  disabled,
}: CampaignHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<CampaignVersionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCampaignObjectVersionsAction({ campaignObjectId });
      if (result.ok) setVersions(result.versions);
      else setError(result.message);
    } finally {
      setLoading(false);
    }
  }, [campaignObjectId]);

  const toggle = useCallback(() => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && versions === null && !loading) void load();
  }, [open, versions, loading, load]);

  const recentChanges = [...changeLog].reverse().slice(0, 8);

  return (
    <div className="border-t border-border/60">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-[11px] font-bold tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
        onClick={toggle}
        aria-expanded={open}
      >
        <HistoryIcon className="size-3.5" />
        Change history
        <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
          {open ? "Hide" : `${changeLog.length} change${changeLog.length === 1 ? "" : "s"}`}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 px-4 pb-4">
          {recentChanges.length > 0 ? (
            <ol className="space-y-1.5">
              {recentChanges.map((entry, i) => (
                <li key={`${entry.appliedAt}-${i}`} className="flex items-start gap-2 text-[11px]">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#1D9E75]" />
                  <span className="min-w-0 flex-1 text-foreground">
                    {entry.summary}
                    {entry.overallScoreAfter != null ? (
                      <span className="text-muted-foreground"> · score {entry.overallScoreAfter}</span>
                    ) : null}
                    <span className="text-muted-foreground/70"> · {relativeTime(entry.appliedAt)}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No edits yet — ask the Copilot to change the campaign and each edit will appear here.
            </p>
          )}

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              Restore a version
            </p>
            {loading ? (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" /> Loading versions…
              </p>
            ) : error ? (
              <p className="text-[11px] text-destructive">{error}</p>
            ) : versions && versions.length > 0 ? (
              <ul className="space-y-1">
                {versions.map((v) => (
                  <li
                    key={v.version}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5"
                  >
                    <span className="text-[11px] font-semibold">Version {v.version}</span>
                    <span className="text-[10px] text-muted-foreground">{relativeTime(v.createdAt)}</span>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={disabled || !onRestore}
                      className="ml-auto h-6 px-2 text-[11px] text-muted-foreground hover:text-[#1D9E75]"
                      onClick={() => onRestore?.(v.version)}
                    >
                      <RotateCcwIcon className="size-3" />
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">No saved versions yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
