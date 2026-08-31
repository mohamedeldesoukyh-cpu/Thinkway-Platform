"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { releaseDeliverableVersionToClientAction } from "@/features/campaigns/actions/deliverable-documentation-actions";

export function ReleaseVersionToClientButton({
  campaignHeaderId,
  versionId,
  releasedToClientAt,
  onReleased,
}: {
  campaignHeaderId: string;
  versionId: string;
  releasedToClientAt: string | null | undefined;
  onReleased?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  if (releasedToClientAt) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground">Released to Client</p>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="mt-2 h-8"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await releaseDeliverableVersionToClientAction({
            campaignHeaderId,
            versionId,
          });
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success("Released to Client");
          onReleased?.();
        });
      }}
    >
      Release to Client
    </Button>
  );
}
