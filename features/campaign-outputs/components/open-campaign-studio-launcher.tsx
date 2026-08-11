"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboardIcon, LayersIcon, Loader2Icon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { StudioTab } from "../actions/campaign-workspace-message";
import { startCampaignOutputsFromSeed } from "../actions/generate-outputs-action";
import type { CampaignSeed } from "../hydration/hydration-types";

export type OpenCampaignStudioLauncherProps = {
  seed: CampaignSeed;
  tab?: StudioTab;
  workspace?: { type?: string; id?: string };
  existingConversationId?: string;
  /** Button label — defaults from tab. */
  label?: string;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  className?: string;
  buttonClassName?: string;
  showIcon?: boolean;
};

const TAB_LABELS: Record<StudioTab, string> = {
  studio: "Open Studio",
  outputs: "Open Outputs",
  director: "Open Director",
};

const TAB_ICONS: Record<StudioTab, typeof LayoutDashboardIcon> = {
  studio: LayoutDashboardIcon,
  outputs: LayersIcon,
  director: SparklesIcon,
};

/**
 * One-click entry into the Campaign Studio workspace from any business context
 * (quotation, shortlist, CRM campaign). Reuses the shared seed → conversation
 * hydration path; never duplicates studio logic.
 */
export function OpenCampaignStudioLauncher({
  seed,
  tab = "studio",
  workspace,
  existingConversationId,
  label,
  variant = "primary",
  size = "sm",
  className,
  buttonClassName,
  showIcon = true,
}: OpenCampaignStudioLauncherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const Icon = TAB_ICONS[tab];
  const displayLabel = label ?? TAB_LABELS[tab];

  const launch = () => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await Promise.race([
          startCampaignOutputsFromSeed({
            seed,
            existingConversationId,
            tab,
            workspace,
          }),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => {
              reject(new Error("Timed out opening Studio. Please try again."));
            }, 45_000);
          }),
        ]);
        if (result.ok) router.push(result.href);
        else setError(result.message);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to open Studio.");
      }
    });
  };

  return (
    <div className={cn("inline-flex flex-col items-end gap-0.5", className)}>
      <button
        type="button"
        onClick={launch}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50",
          !buttonClassName &&
            (size === "sm"
              ? "h-[30px] rounded-[var(--camp-radius,8px)] px-3 text-[11px]"
              : "h-9 rounded-lg px-4 text-xs"),
          !buttonClassName &&
            variant === "primary" &&
            "bg-[var(--tw-primary,#1D9E75)] text-white hover:bg-[#178a66]",
          !buttonClassName &&
            variant === "outline" &&
            "border border-border bg-background text-foreground hover:bg-muted/50",
          !buttonClassName &&
            variant === "ghost" &&
            "h-9 rounded-[10px] border border-transparent bg-transparent px-3.5 text-[13px] font-semibold text-[var(--text-2)] hover:bg-muted/40",
          buttonClassName
        )}
      >
        {pending ? (
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
        ) : showIcon ? (
          <Icon className="size-3.5" aria-hidden />
        ) : null}
        {displayLabel}
      </button>
      {error ? <p className="text-[10px] text-red-500">{error}</p> : null}
    </div>
  );
}
