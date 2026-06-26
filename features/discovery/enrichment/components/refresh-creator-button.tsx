"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { refreshCreatorAction } from "../actions";
import { formatLastUpdated } from "../status";

/**
 * Self-contained "Refresh Creator" control (spec §1/§3, priority 4).
 * Enqueues a forced enrichment job, shows a loading state, and reports the last
 * update time. Designed to be slotted into the creator detail sheet by Phase 2.5
 * without touching shared files.
 */
export function RefreshCreatorButton({
  influencerId,
  lastEnrichedAt,
  size = "sm",
  variant = "outline",
  showTimestamp = true,
  className,
  onQueued,
}: {
  influencerId: string;
  lastEnrichedAt?: string | null;
  size?: "xs" | "sm" | "default";
  variant?: "outline" | "ghost" | "secondary" | "default";
  showTimestamp?: boolean;
  className?: string;
  onQueued?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const result = await refreshCreatorAction(influencerId);
      if (result.queued) {
        setQueued(true);
        toast.success("Refresh queued", {
          description: "Latest data will appear once enrichment completes.",
        });
        onQueued?.();
      } else {
        toast.error("Could not refresh", { description: result.message });
      }
    });
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handleClick}
        disabled={isPending || queued}
      >
        {isPending ? (
          <Loader2Icon className="animate-spin" aria-hidden />
        ) : (
          <RefreshCwIcon aria-hidden />
        )}
        {queued ? "Queued" : "Refresh Creator"}
      </Button>
      {showTimestamp ? (
        <span className="text-xs text-muted-foreground">
          Updated {formatLastUpdated(lastEnrichedAt)}
        </span>
      ) : null}
    </div>
  );
}
