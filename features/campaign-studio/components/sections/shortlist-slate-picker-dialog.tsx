"use client";

import { useCallback, useEffect, useState } from "react";
import { ListIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  listStudioShortlistsAction,
  stageShortlistToSlateAction,
  type ShortlistSlateMode,
  type StudioShortlistOption,
} from "../../actions/shortlist-slate-actions";

type ShortlistSlatePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ShortlistSlateMode;
  conversationId: string;
  messageId: string;
  onApplied?: (result: {
    linkedShortlistId?: string;
    draft?: import("@/features/campaign-intelligence/types/section-schemas").StudioDraftState;
  }) => void;
};

export function ShortlistSlatePickerDialog({
  open,
  onOpenChange,
  mode,
  conversationId,
  messageId,
  onApplied,
}: ShortlistSlatePickerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [shortlists, setShortlists] = useState<StudioShortlistOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadShortlists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listStudioShortlistsAction({ conversationId, messageId });
      if (!result.ok) {
        setError(result.message);
        setShortlists([]);
        return;
      }
      setShortlists(result.shortlists);
      setSelectedId(result.shortlists[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [conversationId, messageId]);

  useEffect(() => {
    if (open) void loadShortlists();
  }, [open, loadShortlists]);

  const title = mode === "replace" ? "Stage replace with shortlist" : "Stage merge shortlist";
  const description =
    mode === "replace"
      ? "Stage a full slate replace from an existing shortlist. Nothing changes until you Apply Changes."
      : "Stage shortlist creators to merge into the current slate (deduped). Apply Changes to commit.";

  const handleApply = async () => {
    if (!selectedId) {
      toast.error("Select a shortlist first.");
      return;
    }
    setApplying(true);
    try {
      const result = await stageShortlistToSlateAction({
        conversationId,
        messageId,
        shortlistId: selectedId,
        mode,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onApplied?.({
        linkedShortlistId: result.linkedShortlistId,
        draft: result.draft,
      });
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListIcon className="size-4 text-[#0057FF]" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(360px,50vh)] overflow-y-auto rounded-lg border border-border/70">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading shortlists…
            </div>
          ) : error ? (
            <p className="px-4 py-8 text-center text-sm text-destructive">{error}</p>
          ) : shortlists.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No shortlists with creators found for this client/brand.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {shortlists.map((row) => {
                const active = selectedId === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors",
                        active ? "bg-[#0057FF]/8" : "hover:bg-muted/40"
                      )}
                      onClick={() => setSelectedId(row.id)}
                      aria-pressed={active}
                    >
                      <span className="text-sm font-semibold text-foreground">
                        {row.serial_number ? `${row.serial_number} · ` : ""}
                        {row.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {row.creator_count} creator{row.creator_count === 1 ? "" : "s"}
                        {row.brand_name ? ` · ${row.brand_name}` : ""}
                        {row.client_name ? ` · ${row.client_name}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={applying || loading || !selectedId}
            className="bg-[#0057FF] hover:bg-[#0040CC]"
            onClick={() => void handleApply()}
          >
            {applying ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                Applying…
              </>
            ) : mode === "replace" ? (
              "Stage replace"
            ) : (
              "Stage merge"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
