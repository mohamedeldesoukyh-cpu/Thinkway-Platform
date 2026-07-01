"use client";

import { useTransition } from "react";
import { PauseIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { pauseCreatorImportFileAction } from "@/features/discovery-import/actions";

type PauseImportButtonProps = {
  importFileId: string;
  onPaused?: () => void | Promise<void>;
};

export function PauseImportButton({ importFileId, onPaused }: PauseImportButtonProps) {
  const [pending, startTransition] = useTransition();

  const handlePause = () => {
    startTransition(async () => {
      const result = await pauseCreatorImportFileAction(importFileId);
      if (result.ok) {
        toast.success(result.message);
        await onPaused?.();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1 px-2 text-[10px] font-medium text-muted-foreground"
      disabled={pending}
      onClick={handlePause}
    >
      <PauseIcon className="size-3" />
      {pending ? "Pausing…" : "Pause"}
    </Button>
  );
}
