"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  CREATOR_DELETE_LINK_LABELS,
  type CreatorDeleteLinkRef,
} from "@/lib/discovery/creator-delete-blockers";

import {
  deleteDiscoveryCreatorAction,
  getDiscoveryCreatorDeleteEligibilityAction,
} from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: UnifiedCreatorResult;
  onDeleted?: () => void;
};

function unlockDocumentBodyInteraction() {
  window.requestAnimationFrame(() => {
    document.body.style.pointerEvents = "";
    document.body.style.overflow = "";
    document.body.removeAttribute("data-scroll-locked");
  });
}

function DeleteBlockersList({ links }: { links: CreatorDeleteLinkRef[] }) {
  if (links.length === 0) return null;

  const grouped = links.reduce<Record<string, CreatorDeleteLinkRef[]>>((acc, link) => {
    const bucket = acc[link.kind] ?? [];
    bucket.push(link);
    acc[link.kind] = bucket;
    return acc;
  }, {});

  return (
    <div className="max-h-52 space-y-3 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3">
      {Object.entries(grouped).map(([kind, items]) => (
        <div key={kind}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive">
            {CREATOR_DELETE_LINK_LABELS[kind as CreatorDeleteLinkRef["kind"]]}
          </p>
          <ul className="mt-1 space-y-1">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="text-xs text-foreground">
                <span className="font-mono font-medium">{item.reference}</span>
                {item.name ? (
                  <span className="text-muted-foreground"> — {item.name}</span>
                ) : null}
                <span className="block font-mono text-[10px] text-muted-foreground">{item.id}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DeleteDiscoveryCreatorDialog({
  open,
  onOpenChange,
  creator,
  onDeleted,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<CreatorDeleteLinkRef[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isPending, startTransition] = useTransition();

  const influencerId = creator.influencer_id;

  useEffect(() => {
    if (!open || !influencerId) {
      setMessage(null);
      setBlockers([]);
      setCanDelete(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void getDiscoveryCreatorDeleteEligibilityAction(influencerId).then((result) => {
      if (cancelled) return;
      setCanDelete(result.canDelete);
      setMessage(result.message);
      setBlockers(result.links ?? []);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, influencerId]);

  function handleDelete() {
    if (!influencerId) return;

    startTransition(async () => {
      const result = await deleteDiscoveryCreatorAction(influencerId);
      if (!result.ok) {
        toast.error(result.message);
        setMessage(result.message);
        if (result.links) setBlockers(result.links);
        setCanDelete(false);
        return;
      }

      toast.success(result.message);
      unlockDocumentBodyInteraction();
      onOpenChange(false);
      onDeleted?.();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) unlockDocumentBodyInteraction();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete creator</DialogTitle>
          <DialogDescription>
            Permanently remove <strong>{creator.display_name}</strong> from Thinkway. Deletion is
            only allowed when the creator is not on a campaign, shortlist, quotation, or other
            operational record.
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Checking linked campaigns, shortlists, and quotations…
          </p>
        ) : (
          <>
            {message ? (
              <p
                className={
                  canDelete
                    ? "text-sm text-muted-foreground"
                    : "text-sm text-destructive"
                }
              >
                {message}
              </p>
            ) : null}
            {!canDelete && blockers.length > 0 ? (
              <DeleteBlockersList links={blockers} />
            ) : null}
          </>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || checking || isPending}
          >
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
            Delete creator
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
