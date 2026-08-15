"use client";

import { useState } from "react";
import { AlertCircleIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { regenerateStaleOutputsAction } from "@/features/campaign-outputs/actions/regenerate-stale-outputs";

import type { StudioFreshnessSummary } from "../services/studio-facts-freshness";

type StudioFreshnessBannerProps = {
  summary: StudioFreshnessSummary;
  conversationId?: string;
  campaignObjectId?: string;
  onCampaignObjectUpdated?: (campaignObject: Record<string, unknown>) => void;
};

/**
 * Studio-level freshness banner. Regenerates via the same Outputs Engine action
 * as the Outputs Center — no parallel stale runner.
 */
export function StudioFreshnessBanner({
  summary,
  conversationId,
  campaignObjectId,
  onCampaignObjectUpdated,
}: StudioFreshnessBannerProps) {
  const [busy, setBusy] = useState<"affected" | "all" | null>(null);

  if (!summary.showBanner) return null;

  const canRegenerate = Boolean(
    conversationId && campaignObjectId && summary.regeneratableCount > 0
  );

  const regenerate = async (mode: "affected" | "all") => {
    if (!conversationId || !campaignObjectId || busy) return;
    setBusy(mode);
    try {
      const result = await regenerateStaleOutputsAction({
        conversationId,
        campaignObjectId,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onCampaignObjectUpdated?.(result.campaignObject);
      toast.success(result.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/90 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-amber-800 dark:bg-amber-950/80"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
          <AlertCircleIcon className="size-3.5 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
            Campaign information changed
          </p>
          <p className="break-words text-[11px] text-amber-800/80 dark:text-amber-300/80">
            Some recommendations are based on the previous campaign facts {summary.cause}.
            Do not silently regenerate — choose when to update.
          </p>
        </div>
      </div>
      {canRegenerate ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={Boolean(busy)}
            className="h-8 px-3 text-xs"
            onClick={() => void regenerate("affected")}
          >
            {busy === "affected" ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
            {busy === "affected" ? "Regenerating…" : "Regenerate affected"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={Boolean(busy)}
            className="h-8 bg-[#0057FF] px-3 text-xs hover:bg-[#0040CC]"
            onClick={() => void regenerate("all")}
          >
            {busy === "all" ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
            {busy === "all" ? "Regenerating all…" : "Regenerate all"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
