"use client";

import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { resetDemoImportedCreatorsAction } from "@/features/discovery-import/actions";

type ResetDemoCreatorsButtonProps = {
  enabled: boolean;
};

export function ResetDemoCreatorsButton({ enabled }: ResetDemoCreatorsButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!enabled) {
    return null;
  }

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await resetDemoImportedCreatorsAction();
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
