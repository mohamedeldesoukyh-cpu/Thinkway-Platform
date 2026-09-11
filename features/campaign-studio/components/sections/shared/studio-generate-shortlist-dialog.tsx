"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listStudioShortlistsAction } from "@/features/campaign-studio/actions/shortlist-slate-actions";
import type { StudioShortlistOption } from "@/features/campaign-studio/actions/shortlist-slate-actions";

export type GenerateShortlistMode = "new" | "existing";

export type GenerateShortlistConfirmation =
  | { mode: "new"; campaignName: string }
  | { mode: "existing"; shortlistId: string };

/**
 * Where the selection is written — the ONLY entry point that touches a
 * shortlist in this flow.
 *
 * Two intents, kept apart. "Generate new shortlist" creates one shortlist for
 * the whole selection and takes an OPTIONAL campaign name. "Add to existing
 * shortlist" asks which shortlist and asks for nothing else: the operator
 * already named that list, so a campaign name is neither requested nor
 * validated, and the chosen shortlist is never renamed.
 *
 * The existing shortlists come from `listStudioShortlistsAction`, the product's
 * own campaign-scoped source — no second fetch and no new model.
 */
export function StudioGenerateShortlistDialog({
  open,
  onOpenChange,
  selectedCount,
  defaultCampaignName,
  conversationId,
  messageId,
  generating,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  defaultCampaignName?: string;
  conversationId?: string;
  messageId?: string;
  generating: boolean;
  error?: string | null;
  onConfirm: (confirmation: GenerateShortlistConfirmation) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={generating ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Shortlist</DialogTitle>
          <DialogDescription>
            {selectedCount} selected creator{selectedCount === 1 ? "" : "s"}. What would you like
            to do?
          </DialogDescription>
        </DialogHeader>

        {/*
          Mounted only while open and keyed on the prefill, so the form always
          opens fresh and an abandoned edit never persists.
        */}
        {open ? (
          <GenerateShortlistForm
            key={defaultCampaignName ?? ""}
            selectedCount={selectedCount}
            defaultCampaignName={defaultCampaignName}
            conversationId={conversationId}
            messageId={messageId}
            generating={generating}
            error={error}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function GenerateShortlistForm({
  selectedCount,
  defaultCampaignName,
  conversationId,
  messageId,
  generating,
  error,
  onConfirm,
  onCancel,
}: {
  selectedCount: number;
  defaultCampaignName?: string;
  conversationId?: string;
  messageId?: string;
  generating: boolean;
  error?: string | null;
  onConfirm: (confirmation: GenerateShortlistConfirmation) => void;
  onCancel: () => void;
}) {
  // `new` is the default: it is the branch that cannot touch a list the
  // operator did not choose.
  const [mode, setMode] = useState<GenerateShortlistMode>("new");
  const [campaignName, setCampaignName] = useState(defaultCampaignName ?? "");
  const [shortlists, setShortlists] = useState<StudioShortlistOption[] | null>(null);
  const [shortlistsError, setShortlistsError] = useState<string | null>(null);
  const [selectedShortlistId, setSelectedShortlistId] = useState<string>("");

  // Existing shortlists are fetched only when that branch is chosen.
  useEffect(() => {
    if (mode !== "existing" || shortlists || !conversationId || !messageId) return;
    let cancelled = false;
    void listStudioShortlistsAction({ conversationId, messageId }).then((result) => {
      if (cancelled) return;
      if (result.ok) setShortlists(result.shortlists);
      else setShortlistsError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, shortlists, conversationId, messageId]);

  const loadingShortlists = mode === "existing" && shortlists === null && !shortlistsError;
  const hasExisting = (shortlists?.length ?? 0) > 0;

  return (
    <>
      <fieldset className="grid gap-2" disabled={generating}>
        <legend className="sr-only">What would you like to do?</legend>
        <Label className="flex items-start gap-2 rounded-lg border border-border/70 p-2.5 text-sm font-normal">
          <input
            type="radio"
            name="studio-shortlist-mode"
            value="new"
            checked={mode === "new"}
            onChange={() => setMode("new")}
            className="mt-1 accent-[#0057FF]"
          />
          <span>
            <span className="block font-semibold text-foreground">Generate new shortlist</span>
            <span className="block text-[11px] text-muted-foreground">
              Creates one shortlist containing the {selectedCount} selected creator
              {selectedCount === 1 ? "" : "s"}.
            </span>
          </span>
        </Label>
        <Label className="flex items-start gap-2 rounded-lg border border-border/70 p-2.5 text-sm font-normal">
          <input
            type="radio"
            name="studio-shortlist-mode"
            value="existing"
            checked={mode === "existing"}
            onChange={() => setMode("existing")}
            className="mt-1 accent-[#0057FF]"
          />
          <span>
            <span className="block font-semibold text-foreground">Add to existing shortlist</span>
            <span className="block text-[11px] text-muted-foreground">
              Adds the selection to a shortlist you already have.
            </span>
          </span>
        </Label>
      </fieldset>

      {mode === "new" ? (
        <div className="space-y-1.5">
          <Label htmlFor="studio-shortlist-campaign-name">Campaign name</Label>
          <Input
            id="studio-shortlist-campaign-name"
            value={campaignName}
            placeholder="Optional"
            disabled={generating}
            onChange={(event) => setCampaignName(event.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Optional. Left blank, the shortlist is saved under Thinkway&apos;s own reference name
            — generation is not blocked.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Select a shortlist</p>
          {loadingShortlists ? (
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
              Loading your shortlists…
            </p>
          ) : shortlistsError ? (
            <p role="alert" className="text-[12px] text-red-700 dark:text-red-300">
              {shortlistsError}
            </p>
          ) : !hasExisting ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-3">
              {/* Honest, and no hidden shortlist is created to fill the gap. */}
              <p className="text-[12px] text-muted-foreground">
                No existing shortlists available.
              </p>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                className="mt-2"
                onClick={() => setMode("new")}
              >
                Generate new shortlist instead
              </Button>
            </div>
          ) : (
            <fieldset
              className="grid max-h-56 gap-1.5 overflow-y-auto"
              disabled={generating}
            >
              <legend className="sr-only">Select a shortlist</legend>
              {shortlists!.map((shortlist) => (
                <Label
                  key={shortlist.id}
                  className="flex items-start gap-2 rounded-lg border border-border/70 p-2.5 text-sm font-normal"
                >
                  <input
                    type="radio"
                    name="studio-existing-shortlist"
                    value={shortlist.id}
                    checked={selectedShortlistId === shortlist.id}
                    onChange={() => setSelectedShortlistId(shortlist.id)}
                    className="mt-1 accent-[#0057FF]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">
                      {shortlist.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {shortlist.creator_count} creator
                      {shortlist.creator_count === 1 ? "" : "s"}
                      {shortlist.brand_name ? ` · ${shortlist.brand_name}` : ""}
                      {!shortlist.brand_name && shortlist.client_name
                        ? ` · ${shortlist.client_name}`
                        : ""}
                    </span>
                  </span>
                </Label>
              ))}
            </fieldset>
          )}
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300/70 bg-red-50/80 px-3 py-2 text-[12px] text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100"
        >
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={generating} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={
            generating ||
            selectedCount === 0 ||
            // The existing branch needs a chosen shortlist. The new branch
            // needs nothing beyond the selection — never a campaign name.
            (mode === "existing" && !selectedShortlistId)
          }
          onClick={() =>
            onConfirm(
              mode === "existing"
                ? { mode: "existing", shortlistId: selectedShortlistId }
                : { mode: "new", campaignName }
            )
          }
        >
          {generating ? (
            <>
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
              {mode === "existing" ? "Adding to shortlist…" : "Generating shortlist…"}
            </>
          ) : mode === "existing" ? (
            "Add to Shortlist"
          ) : (
            "Generate New Shortlist"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
