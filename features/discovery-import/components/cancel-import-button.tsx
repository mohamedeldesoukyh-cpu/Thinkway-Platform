"use client";

import { useState, useTransition } from "react";
import { OctagonIcon } from "lucide-react";
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
import { cancelCreatorImportFileAction } from "@/features/discovery-import/actions";

type CancelImportButtonProps = {
  importFileId: string;
  filename: string;
  onCancelled?: () => void | Promise<void>;
};

export function CancelImportButton({
  importFileId,
  filename,
  onCancelled,
}: CancelImportButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await cancelCreatorImportFileAction(importFileId);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        await onCancelled?.();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-[10px] font-medium text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <OctagonIcon className="size-3" />
        Stop
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!pending) setOpen(nextOpen);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Stop import processing?</DialogTitle>
            <DialogDescription>
              This will cancel queue jobs for{" "}
              <span className="font-medium text-foreground">{filename}</span>.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Creators already imported from partial chunks will remain in Discovery. The import will
            be marked as failed with &ldquo;Cancelled by user&rdquo;.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Keep processing
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={handleConfirm}>
              {pending ? "Stopping…" : "Stop import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
