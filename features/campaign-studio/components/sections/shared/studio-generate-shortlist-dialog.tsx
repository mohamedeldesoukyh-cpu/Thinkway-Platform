"use client";

import { useState } from "react";
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

/**
 * Confirm what is about to be generated, and under what name.
 *
 * The campaign name is prefilled from the campaign when there is one, is
 * editable, and is OPTIONAL: `resolveGeneratedShortlistName` falls back to the
 * product's existing reference label, so a blank field never blocks the button
 * and no campaign name is invented to satisfy the form.
 *
 * Success and failure both come from the action's own result. On failure the
 * dialog stays open with the message and the selection untouched, so the
 * operator can retry.
 */
export function StudioGenerateShortlistDialog({
  open,
  onOpenChange,
  selectedCount,
  defaultCampaignName,
  generating,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  defaultCampaignName?: string;
  generating: boolean;
  error?: string | null;
  onConfirm: (campaignName: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={generating ? undefined : onOpenChange}>
      {/*
        The form mounts only while the dialog is open and is keyed on the
        prefill, so it always opens with the campaign's current name and an
        abandoned edit never persists — no effect syncing state to a prop.
      */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Shortlist</DialogTitle>
          <DialogDescription>
            You are about to generate a shortlist with{" "}
            <b className="text-foreground">
              {selectedCount} selected creator{selectedCount === 1 ? "" : "s"}
            </b>
            .
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <GenerateShortlistForm
            key={defaultCampaignName ?? ""}
            selectedCount={selectedCount}
            defaultCampaignName={defaultCampaignName}
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
  generating,
  error,
  onConfirm,
  onCancel,
}: {
  selectedCount: number;
  defaultCampaignName?: string;
  generating: boolean;
  error?: string | null;
  onConfirm: (campaignName: string) => void;
  onCancel: () => void;
}) {
  const [campaignName, setCampaignName] = useState(defaultCampaignName ?? "");

  return (
    <>
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
          disabled={generating || selectedCount === 0}
          onClick={() => onConfirm(campaignName)}
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
      </DialogFooter>
    </>
  );
}
