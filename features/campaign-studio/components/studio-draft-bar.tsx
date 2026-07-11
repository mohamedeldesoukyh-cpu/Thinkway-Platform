"use client";

import { useState } from "react";
import { PencilRulerIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { StudioDraftState } from "@/features/campaign-intelligence/types/section-schemas";

import {
  applyStudioDraftAction,
  discardStudioDraftAction,
} from "../actions/studio-draft-actions";

type StudioDraftBarProps = {
  conversationId: string;
  messageId: string;
  draft: StudioDraftState;
  onDraftUpdated: (draft: StudioDraftState) => void;
  /** Applied removals — lets the slate update in place without a reload. */
  onCreatorsRemoved?: (creatorIds: string[]) => void;
};

function describeChanges(draft: StudioDraftState): string {
  const counts = new Map<string, number>();
  for (const change of draft.changes) {
    counts.set(change.kind, (counts.get(change.kind) ?? 0) + 1);
  }
  const labels: Record<string, [string, string]> = {
    remove_creator: ["creator removal", "creator removals"],
    replace_creator: ["creator replacement", "creator replacements"],
    add_creator: ["creator addition", "creator additions"],
    refresh_intelligence: ["intelligence refresh", "intelligence refreshes"],
  };
  return [...counts.entries()]
    .map(([kind, count]) => {
      const [singular, plural] = labels[kind] ?? [kind, kind];
      return `${count} ${count === 1 ? singular : plural}`;
    })
    .join(" · ");
}

/** Sticky summary of staged Studio edits — apply everything in one operation or discard. */
export function StudioDraftBar({
  conversationId,
  messageId,
  draft,
  onDraftUpdated,
  onCreatorsRemoved,
}: StudioDraftBarProps) {
  const [busy, setBusy] = useState<"apply" | "discard" | null>(null);

  if (draft.changes.length === 0) return null;

  const run = async (action: "apply" | "discard") => {
    setBusy(action);
    try {
      const result =
        action === "apply"
          ? await applyStudioDraftAction({ conversationId, messageId })
          : await discardStudioDraftAction({ conversationId, messageId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.draft) onDraftUpdated(result.draft);
      const removedCreatorIds =
        action === "apply" && "removedCreatorIds" in result
          ? ((result as { removedCreatorIds?: string[] }).removedCreatorIds ?? [])
          : [];
      if (removedCreatorIds.length > 0) {
        onCreatorsRemoved?.(removedCreatorIds);
      }
      toast.success(result.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/90 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-amber-800 dark:bg-amber-950/80"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
          <PencilRulerIcon className="size-3.5 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
            {draft.changes.length} pending change{draft.changes.length === 1 ? "" : "s"} —
            dependent sections marked outdated
          </p>
          <p className="break-words text-[11px] text-amber-800/80 dark:text-amber-300/80">
            {describeChanges(draft)} · nothing recalculates until you apply
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy != null}
          className="h-8 px-2.5 text-xs text-amber-800 hover:bg-amber-100 dark:text-amber-300"
          onClick={() => void run("discard")}
        >
          <RotateCcwIcon className="size-3.5" />
          Discard all
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy != null}
          className="h-8 bg-[#1D9E75] px-3 text-xs hover:bg-[#178f69]"
          onClick={() => void run("apply")}
        >
          <SparklesIcon className="size-3.5" />
          {busy === "apply" ? "Applying…" : "Apply All Updates"}
        </Button>
      </div>
    </div>
  );
}
