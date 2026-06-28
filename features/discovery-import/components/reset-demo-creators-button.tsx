"use client";

import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { resetDemoImportedCreatorsAction } from "@/features/discovery-import/actions";

type ResetDemoCreatorsButtonProps = {
  enabled: boolean;
};

export function ResetDemoCreatorsButton({ enabled }: ResetDemoCreatorsButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alsoDeleteDiscoveryProfiles, setAlsoDeleteDiscoveryProfiles] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!enabled) {
    return null;
  }

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await resetDemoImportedCreatorsAction({
        alsoDeleteDiscoveryProfiles,
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setAlsoDeleteDiscoveryProfiles(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setAlsoDeleteDiscoveryProfiles(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="border-destructive/40">
          <Trash2Icon className="size-4" />
          Reset demo creators
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Reset demo creators</DialogTitle>
          <DialogDescription>
            Delete all imported demo creators?
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Removes CSV-imported influencers, their platform accounts, creator source
          links, and enrichment run history. Local/demo only — blocked in production
          unless <code className="text-[11px]">DEMO_RESET_ENABLED</code> is set.
        </p>
        <div className="flex items-start gap-2 rounded-md border border-border/60 p-3">
          <Checkbox
            id="also-delete-discovery-profiles"
            checked={alsoDeleteDiscoveryProfiles}
            onCheckedChange={(checked) =>
              setAlsoDeleteDiscoveryProfiles(checked === true)
            }
            disabled={pending}
          />
          <div className="grid gap-1">
            <Label
              htmlFor="also-delete-discovery-profiles"
              className="cursor-pointer text-sm font-normal leading-none"
            >
              Also delete Discovery profiles
            </Label>
            <p className="text-xs text-muted-foreground">
              Clears all staging data in Discovery Search (profiles, posts, metrics,
              AI scores, and discovery sources).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? "Deleting…" : "Confirm delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
