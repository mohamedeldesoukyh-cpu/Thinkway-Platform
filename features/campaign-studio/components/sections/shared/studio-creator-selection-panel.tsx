"use client";

import { Loader2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  canGenerateShortlist,
  type StudioSelectedCreator,
} from "@/features/campaign-studio/services/studio-creator-selection";
import { cn } from "@/lib/utils";

/**
 * The selection calculator that stays open while the operator browses.
 *
 * "+ Shortlist" used to change state with nothing but a toast, so the operator
 * had no running view of what they had picked. This is a presentation layer
 * over the canonical selection (`vendorDecisions[id] === "shortlisted"`, via
 * `resolveStudioCreatorSelection`) — it holds no selection state of its own, so
 * the panel, the card buttons and Generate Shortlist cannot disagree.
 *
 * Desktop: a persistent right-hand column inside the Creators workspace, so
 * browsing, searching, filtering and opening Creator Details all leave it in
 * place. Below `xl` the same component renders as a stacked block, which is
 * what keeps narrow widths free of horizontal overflow.
 */
export function StudioCreatorSelectionPanel({
  creators,
  onRemove,
  onGenerate,
  generating,
  canAct,
  className,
}: {
  creators: StudioSelectedCreator[];
  onRemove: (creatorId: string) => void;
  onGenerate: () => void;
  generating: boolean;
  canAct: boolean;
  className?: string;
}) {
  const count = creators.length;

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
        <h3 className="text-sm font-extrabold tracking-[-0.2px] text-foreground">
          Shortlist Selection
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground" aria-live="polite">
          {count === 0
            ? "No creators selected yet"
            : `${count} creator${count === 1 ? "" : "s"} selected`}
        </p>
      </header>

      {count === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-[11px] text-muted-foreground">
          Use <span className="font-semibold text-foreground">+ Shortlist</span> on a creator to
          start building the selection. It stays here while you browse.
        </p>
      ) : (
        <ul className="m-0 min-h-0 flex-1 list-none space-y-1.5 overflow-y-auto p-0">
          {creators.map((creator) => (
            <li
              key={creator.creatorId}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/10 px-2 py-1.5"
            >
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
                  {creator.handle ? creator.handle : null}
                  {creator.handle && creator.platform ? " · " : null}
                  {creator.platform ? creator.platform : null}
                </span>
              </span>
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
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        className="w-full"
        size="sm"
        // One policy for the gate: creators, never a campaign name.
        disabled={!canAct || !canGenerateShortlist({ selectedCount: count, generating })}
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
