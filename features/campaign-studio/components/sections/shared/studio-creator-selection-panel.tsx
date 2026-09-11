"use client";

import { CheckIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  canGenerateShortlist,
} from "@/features/campaign-studio/services/studio-creator-selection";
import type { StudioDecisionRow } from "@/features/campaign-studio/services/studio-creator-decisions";
import { cn } from "@/lib/utils";

/**
 * The selection calculator that stays open while the operator browses.
 *
 * Two independent facts, shown apart: what is SELECTED for the shortlist, and
 * what has been APPROVED. A creator may be either, both or neither, so a row
 * that is both reads "Approved · Selected" rather than appearing twice.
 *
 * It holds no decision state — every row comes from
 * `resolveStudioDecisionRows`, over the campaign's `vendorDecisions` and its
 * staged draft. Approving something here cannot overwrite a selection, and
 * nothing on this panel writes a persisted shortlist: only Generate Shortlist
 * does that.
 */
export function StudioCreatorSelectionPanel({
  selected,
  approved,
  approvedToAdd,
  onRemove,
  onAddApproved,
  onAddAllApproved,
  onGenerate,
  generating,
  addingApproved,
  canAct,
  className,
}: {
  selected: StudioDecisionRow[];
  approved: StudioDecisionRow[];
  /** Approved creators not yet selected — what "Add all approved" would add. */
  approvedToAdd: StudioDecisionRow[];
  onRemove: (creatorId: string) => void;
  onAddApproved: (creatorId: string) => void;
  onAddAllApproved: () => void;
  onGenerate: () => void;
  generating: boolean;
  addingApproved: boolean;
  canAct: boolean;
  className?: string;
}) {
  const selectedCount = selected.length;

  return (
    <aside
      aria-label="Shortlist selection"
      data-studio-selection-panel
      className={cn(
        "flex min-h-0 flex-col gap-3 rounded-xl border border-[#0B0F1A]/8 bg-white p-3 dark:border-border dark:bg-background",
        className
      )}
    >
      <header>
        <h3 className="text-sm font-extrabold tracking-[-0.2px] text-foreground">Selection</h3>
      </header>

      <section className="min-h-0">
        <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
          Selected
        </p>
        <p className="text-[11px] text-muted-foreground" aria-live="polite">
          {selectedCount === 0
            ? "No creators selected yet"
            : `${selectedCount} creator${selectedCount === 1 ? "" : "s"}`}
        </p>
        {selectedCount === 0 ? (
          <p className="mt-1.5 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-3 text-[11px] text-muted-foreground">
            Use <span className="font-semibold text-foreground">+ Shortlist</span> on a creator to
            start building the selection. It stays here while you browse.
          </p>
        ) : (
          <ul className="m-0 mt-1.5 max-h-56 list-none space-y-1.5 overflow-y-auto p-0">
            {selected.map((creator) => (
              <CreatorRow
                key={creator.creatorId}
                creator={creator}
                canAct={canAct}
                action={
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="h-6 shrink-0 px-1.5 text-[10px]"
                    disabled={!canAct || creator.pending}
                    onClick={() => onRemove(creator.creatorId)}
                    aria-label={`Remove ${creator.displayName} from the selection`}
                  >
                    {creator.pending ? (
                      <>
                        <Loader2Icon className="size-3 animate-spin" aria-hidden />
                        Removing…
                      </>
                    ) : (
                      <>
                        <XIcon className="size-3" aria-hidden />
                        Remove
                      </>
                    )}
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="min-h-0 border-t border-border/60 pt-2.5">
        <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
          Approved
        </p>
        <p className="text-[11px] text-muted-foreground" aria-live="polite">
          {approved.length === 0
            ? "No creators approved yet"
            : `${approved.length} creator${approved.length === 1 ? "" : "s"}`}
        </p>
        {approved.length > 0 ? (
          <>
            <ul className="m-0 mt-1.5 max-h-56 list-none space-y-1.5 overflow-y-auto p-0">
              {approved.map((creator) => (
                <CreatorRow
                  key={creator.creatorId}
                  creator={creator}
                  canAct={canAct}
                  action={
                    creator.selected ? (
                      <span className="flex shrink-0 items-center gap-1 px-1.5 text-[10px] font-semibold text-[#0C9D57]">
                        <CheckIcon className="size-3" aria-hidden />
                        Added
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        className="h-6 shrink-0 px-1.5 text-[10px]"
                        disabled={!canAct || creator.pending}
                        onClick={() => onAddApproved(creator.creatorId)}
                        aria-label={`Add ${creator.displayName} to the selection`}
                      >
                        {creator.pending ? (
                          <>
                            <Loader2Icon className="size-3 animate-spin" aria-hidden />
                            Adding…
                          </>
                        ) : (
                          <>
                            <PlusIcon className="size-3" aria-hidden />
                            Add
                          </>
                        )}
                      </Button>
                    )
                  }
                />
              ))}
            </ul>
            {/*
              Adds to the SELECTION, never to a persisted shortlist. Already
              selected creators are skipped rather than duplicated.
            */}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2 w-full"
              disabled={!canAct || addingApproved || approvedToAdd.length === 0}
              onClick={onAddAllApproved}
            >
              {addingApproved ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                  Adding approved…
                </>
              ) : approvedToAdd.length === 0 ? (
                "All approved are in the selection"
              ) : (
                `Add all approved (${approvedToAdd.length})`
              )}
            </Button>
          </>
        ) : null}
      </section>

      <Button
        type="button"
        className="w-full"
        size="sm"
        // One policy for the gate: creators, never a campaign name.
        disabled={!canAct || !canGenerateShortlist({ selectedCount, generating })}
        onClick={onGenerate}
      >
        {generating ? (
          <>
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
            Generating Shortlist…
          </>
        ) : (
          "Generate Shortlist"
        )}
      </Button>
    </aside>
  );
}

function CreatorRow({
  creator,
  action,
}: {
  creator: StudioDecisionRow;
  canAct: boolean;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/10 px-2 py-1.5">
      {creator.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- same treatment as the creator cards
        <img
          src={creator.avatarUrl}
          alt=""
          className="size-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0057FF]/10 text-[10px] font-bold text-[#0057FF]"
        >
          {creator.displayName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-foreground">
          {creator.displayName}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {/* Both facts on one row, so a creator never appears twice. */}
          {[
            creator.handle,
            creator.platform,
            creator.approved && creator.selected ? "Approved · Selected" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {action}
    </li>
  );
}
