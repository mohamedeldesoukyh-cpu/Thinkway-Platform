"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Columns2Icon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadStudioEciPlanningSignalsAction } from "@/features/campaign-studio/actions/studio-eci-actions";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import { cn } from "@/lib/utils";

import {
  StudioPlanningCompareMatrix,
  type StudioPlanningCompareColumn,
} from "./studio-planning-compare-matrix";

const MAX_PLANNING_COMPARE = 5;

export type StudioCompareCreatorOption = {
  id: string;
  displayName: string;
  handle?: string;
  platform?: string;
};

type StudioCreatorCompareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creators: StudioCompareCreatorOption[];
  initialSelectedIds?: string[];
  onOpenCreator?: (unifiedId: string) => void;
};

/**
 * Planning Compare — Enterprise Creator Intelligence planning perspective.
 * Does not reuse Discovery Compare Thinkway metrics.
 */
export function StudioCreatorCompareDialog({
  open,
  onOpenChange,
  creators,
  initialSelectedIds,
  onOpenCreator,
}: StudioCreatorCompareDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [columns, setColumns] = useState<StudioPlanningCompareColumn[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(true);

  const available = useMemo(
    () => creators.filter((c) => Boolean(c.id?.trim())),
    [creators]
  );

  useEffect(() => {
    if (!open) return;
    const seed =
      initialSelectedIds
        ?.filter((id) => available.some((c) => c.id === id))
        .slice(0, MAX_PLANNING_COMPARE) ??
      available.slice(0, Math.min(2, available.length)).map((c) => c.id);
    setSelectedIds(seed);
    setColumns(null);
    setPicking(true);
  }, [open, available, initialSelectedIds]);

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PLANNING_COMPARE) {
        toast.message(`Compare up to ${MAX_PLANNING_COMPARE} creators`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function runCompare() {
    if (selectedIds.length < 2) {
      toast.error("Select at least two creators to compare.");
      return;
    }
    startTransition(async () => {
      const record = await loadStudioEciPlanningSignalsAction(selectedIds);
      const next: StudioPlanningCompareColumn[] = selectedIds.map((id) => {
        const meta = available.find((c) => c.id === id);
        const bare = id.replace(/^inf:/, "").replace(/^dis:/, "");
        const signal: StudioEciPlanningSignal | null =
          record[bare] ?? record[id] ?? null;
        return {
          id,
          displayName: meta?.displayName ?? id,
          handle: meta?.handle,
          signal,
        };
      });
      if (!next.some((c) => c.signal)) {
        toast.error("Could not load Enterprise Creator Intelligence for comparison.");
        return;
      }
      setColumns(next);
      setPicking(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92vh] w-[min(1100px,96vw)] max-w-[1100px] flex-col gap-0 overflow-hidden p-0",
          "sm:rounded-xl"
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Columns2Icon className="size-4 text-[#0057FF]" aria-hidden />
            Strategy Compare
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Who is the better choice for this campaign — business impact, commercial impact,
            expected outcomes, risks, and a final recommendation. Not Discovery Compare.
          </DialogDescription>
        </DialogHeader>

        {picking || !columns ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            <p className="text-[12px] text-muted-foreground">
              Selected {selectedIds.length}/{MAX_PLANNING_COMPARE}
            </p>
            <ul className="space-y-2">
              {available.map((creator) => {
                const checked = selectedIds.includes(creator.id);
                return (
                  <li key={creator.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5",
                        checked
                          ? "border-[#0057FF]/40 bg-[#0057FF]/5"
                          : "border-border bg-background"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleId(creator.id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          {creator.displayName}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {[creator.handle, creator.platform].filter(Boolean).join(" · ") ||
                            creator.id}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {available.length < 2 ? (
              <p className="text-[12px] text-amber-700 dark:text-amber-300">
                Add at least two creators to the slate before comparing.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 sm:px-5">
              <p className="text-[11px] text-muted-foreground">
                Planning intelligence · scroll horizontally on smaller screens
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-[11px]"
                onClick={() => setPicking(true)}
              >
                <PlusIcon className="size-3" aria-hidden />
                Add / change
              </Button>
            </div>
            <StudioPlanningCompareMatrix
              columns={columns}
              onOpenCreator={(id) => onOpenCreator?.(id)}
            />
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-[#f8fafc] px-4 py-3 dark:bg-background sm:px-5">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <XIcon className="mr-1 size-3.5" aria-hidden />
            Close
          </Button>
          {picking || !columns ? (
            <Button
              type="button"
              size="sm"
              className="bg-[#0057FF] hover:bg-[#0040CC]"
              disabled={pending || selectedIds.length < 2}
              onClick={runCompare}
            >
              {pending ? "Loading…" : "Compare selected"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
