"use client";

import { useTransition } from "react";
import { PlayIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { resumeCreatorImportFileAction } from "@/features/discovery-import/actions";

type ResumeImportButtonProps = {
  importFileId: string;
  onResumed?: () => void | Promise<void>;
};

export function ResumeImportButton({ importFileId, onResumed }: ResumeImportButtonProps) {
  const [pending, startTransition] = useTransition();

  const handleResume = () => {
    startTransition(async () => {
      const result = await resumeCreatorImportFileAction(importFileId);
      if (result.ok) {
        toast.success(result.message);
        await onResumed?.();
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
      className="h-7 gap-1 px-2 text-[10px] font-medium text-[#1D9E75]"
      disabled={pending}
      onClick={handleResume}
    >
      <PlayIcon className="size-3" />
      {pending ? "Resuming…" : "Resume"}
    </Button>
  );
}
