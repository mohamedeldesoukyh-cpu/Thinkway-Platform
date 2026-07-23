"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useTransition } from "react";
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
import { deletePlatformFromCreatorAction } from "@/features/discovery/delete-platform/actions";
import { platformLabel } from "@/features/campaigns/line-assignment";
import type { UnifiedCreatorPlatform, UnifiedCreatorResult } from "@/lib/creators/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: UnifiedCreatorResult;
  platform: UnifiedCreatorPlatform | null;
  onDeleted?: (creator: UnifiedCreatorResult, removedPlatformAccountId: string) => void;
};

export function DeleteCreatorPlatformDialog({
  open,
  onOpenChange,
  creator,
  platform,
  onDeleted,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const influencerId = creator.influencer_id;

  if (!platform) return null;

  // Capture after the null guard so async closures keep a non-null binding.
  const targetPlatform = platform;
  const platformName = platformLabel(targetPlatform.platform);
  const handle = targetPlatform.handle?.replace(/^@/, "") ?? null;

  function handleDelete() {
    if (!influencerId) {
      toast.error("This creator cannot be edited yet.");
      return;
    }

    startTransition(async () => {
      const result = await deletePlatformFromCreatorAction({
        influencerId,
        platformAccountId: targetPlatform.id,
        unifiedId: creator.unified_id,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onDeleted?.(result.creator, targetPlatform.id);
      onOpenChange(false);
      window.requestAnimationFrame(() => {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
        document.body.removeAttribute("data-scroll-locked");
      });
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          window.requestAnimationFrame(() => {
            document.body.style.pointerEvents = "";
            document.body.style.overflow = "";
            document.body.removeAttribute("data-scroll-locked");
          });
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {platformName} profile</DialogTitle>
          <DialogDescription>
            Remove{" "}
            <strong>
              {platformName}
              {handle ? ` @${handle}` : ""}
            </strong>{" "}
            from <strong>{creator.display_name}</strong>. The creator will stay in Thinkway with
            their remaining linked platforms.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
                Removing…
              </>
            ) : (
              <>
                <Trash2Icon className="size-4" aria-hidden />
                Remove {platformName}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
