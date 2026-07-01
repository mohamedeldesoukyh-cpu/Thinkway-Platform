"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { PlatformIcon } from "@/lib/performance/platform-icon";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: UnifiedCreatorResult | null;
  onConfirm: (platformAccountIds: string[]) => void;
};

export function SelectPlatformAccountsDialog({
  open,
  onOpenChange,
  creator,
  onConfirm,
}: Props) {
  const platforms = creator ? sortPlatformsStable(creator.platforms) : [];
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !creator) return;
    setSelected(sortPlatformsStable(creator.platforms).map((p) => p.id));
  }, [open, creator]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((value) => value !== id)));
  }

  function handleConfirm() {
    if (selected.length === 0) return;
    onConfirm(selected);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select platform accounts</DialogTitle>
          <DialogDescription>
            {creator
              ? `Choose which accounts to include for ${creator.display_name} on this shortlist.`
              : "Choose platform accounts for this creator."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {platforms.map((platform) => {
            const checked = selected.includes(platform.id);
            return (
              <label
                key={platform.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => toggle(platform.id, value === true)}
                />
                <PlatformIcon platform={platform.platform} size="xs" className="size-5 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {platformLabel(platform.platform)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{platform.handle.replace(/^@/, "")}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={selected.length === 0}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Default platform account ids when no dialog is needed. */
export function defaultPlatformAccountIds(creator: UnifiedCreatorResult): string[] {
  return sortPlatformsStable(creator.platforms).map((p) => p.id);
}

/** Whether the account selector dialog should appear before adding to shortlist. */
export function needsPlatformAccountSelection(creator: UnifiedCreatorResult): boolean {
  return sortPlatformsStable(creator.platforms).length > 1;
}
