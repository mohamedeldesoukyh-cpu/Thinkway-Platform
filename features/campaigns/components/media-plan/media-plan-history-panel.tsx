"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, HistoryIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { restoreMediaPlanEditAction } from "@/features/campaign-outputs/actions/restore-media-plan-edit";
import { pageMediaPlanEditHistory } from "@/features/campaign-outputs/media-plan-edit-history";
import type {
  CampaignOutputVersionSnapshot,
  MediaPlanEditFieldChange,
  MediaPlanEditHistoryEntry,
} from "@/features/campaign-outputs/output-types";
import { cn } from "@/lib/utils";

type HistoryTab = "edit" | "business";

type MediaPlanHistoryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignObjectId: string;
  conversationId: string;
  editHistory: MediaPlanEditHistoryEntry[];
  businessVersions: CampaignOutputVersionSnapshot[];
  currentVersionLabel?: string | null;
};

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `Today ${time}`;
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
  } catch {
    return iso;
  }
}

function actorLabel(entry: MediaPlanEditHistoryEntry): string {
  return entry.actorLabel?.trim() || (entry.actorKind === "user" ? "User" : entry.actorKind);
}

function changeColor(kind: MediaPlanEditFieldChange["changeKind"]): string {
  if (kind === "added") return "text-emerald-700 dark:text-emerald-400";
  if (kind === "removed") return "text-red-700 dark:text-red-400";
  return "text-amber-700 dark:text-amber-400";
}

function EditHistoryRow({
  entry,
  campaignId,
  campaignObjectId,
  conversationId,
  compareAgainst,
}: {
  entry: MediaPlanEditHistoryEntry;
  campaignId: string;
  campaignObjectId: string;
  conversationId: string;
  compareAgainst?: MediaPlanEditHistoryEntry | null;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const compareChanges = useMemo(() => {
    if (!showCompare || !compareAgainst) return entry.fieldChanges;
    // Field changes on the entry already describe before→after for that edit.
    return entry.fieldChanges;
  }, [compareAgainst, entry.fieldChanges, showCompare]);

  const restore = () => {
    startTransition(async () => {
      setError(null);
      const result = await restoreMediaPlanEditAction({
        campaignId,
        campaignObjectId,
        conversationId,
        editNumber: entry.editNumber,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-border/80 bg-background">
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronDownIcon
          className={cn(
            "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded ? "rotate-0" : "-rotate-90"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{actorLabel(entry)}</p>
          <p className="text-[11px] text-muted-foreground">{formatWhen(entry.at)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Edit {entry.editNumber} · {entry.summary}
          </p>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-border/60 px-3 py-2.5">
          {entry.fieldChanges.length ? (
            <ul className="space-y-2">
              {entry.fieldChanges.map((change, idx) => (
                <li key={`${change.field}-${idx}`} className="text-xs">
                  <p className={cn("font-semibold", changeColor(change.changeKind))}>
                    {change.label}
                  </p>
                  {change.changeKind === "added" ? (
                    <p className="text-muted-foreground">Added: {String(change.newValue ?? "—")}</p>
                  ) : change.changeKind === "removed" ? (
                    <p className="text-muted-foreground">Removed: {String(change.oldValue ?? "—")}</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground">Old: {String(change.oldValue ?? "—")}</p>
                      <p className="text-muted-foreground">New: {String(change.newValue ?? "—")}</p>
                    </>
                  )}
                  {idx < entry.fieldChanges.length - 1 ? (
                    <div className="mt-2 border-t border-dashed border-border/70" />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {entry.detailLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            {compareAgainst ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => setShowCompare((v) => !v)}
              >
                {showCompare ? "Hide compare" : "Compare ↔ previous"}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={pending || !entry.contentSnapshot}
              onClick={restore}
            >
              {pending ? <Loader2Icon className="size-3 animate-spin" /> : null}
              Restore
            </Button>
          </div>
          {showCompare && compareAgainst ? (
            <p className="text-[11px] text-muted-foreground">
              Compared to Edit {compareAgainst.editNumber}: {compareChanges.length} change
              {compareChanges.length === 1 ? "" : "s"}.
            </p>
          ) : null}
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function MediaPlanHistoryPanel({
  open,
  onOpenChange,
  campaignId,
  campaignObjectId,
  conversationId,
  editHistory,
  businessVersions,
  currentVersionLabel,
}: MediaPlanHistoryPanelProps) {
  const [tab, setTab] = useState<HistoryTab>("edit");
  const [limit, setLimit] = useState(50);

  const page = useMemo(
    () => pageMediaPlanEditHistory(editHistory, { offset: 0, limit }),
    [editHistory, limit]
  );

  const previousByEdit = useMemo(() => {
    const sorted = [...editHistory].sort((a, b) => a.editNumber - b.editNumber);
    const map = new Map<number, MediaPlanEditHistoryEntry | null>();
    for (let i = 0; i < sorted.length; i++) {
      map.set(sorted[i]!.editNumber, i > 0 ? sorted[i - 1]! : null);
    }
    return map;
  }, [editHistory]);

  const businessSorted = useMemo(
    () =>
      [...businessVersions].sort((a, b) => (b.version ?? 0) - (a.version ?? 0)),
    [businessVersions]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border pb-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <HistoryIcon className="size-4 text-[var(--tw-primary,#1D9E75)]" />
            History
          </SheetTitle>
          <SheetDescription className="text-xs">
            Edit History is the productivity trail. Business Versions are approval milestones.
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex shrink-0 gap-1 border-b border-border px-1 py-2"
          role="tablist"
          aria-label="History views"
        >
          {(
            [
              { id: "edit" as const, label: "Edit History" },
              { id: "business" as const, label: "Business Versions" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                tab === item.id
                  ? "bg-[var(--tw-primary,#1D9E75)] text-white"
                  : "text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 py-3">
          {tab === "edit" ? (
            page.items.length ? (
              <>
                {page.items.map((entry) => (
                  <EditHistoryRow
                    key={entry.editNumber}
                    entry={entry}
                    campaignId={campaignId}
                    campaignObjectId={campaignObjectId}
                    conversationId={conversationId}
                    compareAgainst={previousByEdit.get(entry.editNumber) ?? null}
                  />
                ))}
                {page.hasMore ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setLimit((n) => n + 50)}
                  >
                    Load more ({page.total - page.items.length} older)
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="px-2 text-xs text-muted-foreground">
                No edits recorded yet. Schedule changes and regenerations appear here.
              </p>
            )
          ) : (
            <>
              {currentVersionLabel ? (
                <div className="rounded-lg border border-[var(--tw-primary,#1D9E75)]/40 bg-[var(--tw-primary,#1D9E75)]/5 px-3 py-2.5">
                  <p className="text-sm font-medium">Current · {currentVersionLabel}</p>
                  <p className="text-[11px] text-muted-foreground">Working tip (business version)</p>
                </div>
              ) : null}
              {businessSorted.length ? (
                businessSorted.map((snap) => (
                  <div
                    key={`${snap.version}-${snap.versionLabel ?? ""}`}
                    className="rounded-lg border border-border/80 px-3 py-2.5"
                  >
                    <p className="text-sm font-medium">
                      {snap.versionLabel ?? `v${snap.version}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {snap.businessStatus ?? "—"}
                      {snap.updatedAt || snap.generatedAt
                        ? ` · ${formatWhen(snap.updatedAt ?? snap.generatedAt!)}`
                        : null}
                    </p>
                    {snap.changeSummary ? (
                      <p className="mt-1 text-xs text-muted-foreground">{snap.changeSummary}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="px-2 text-xs text-muted-foreground">
                  No prior business versions yet. Approval milestones appear here.
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
