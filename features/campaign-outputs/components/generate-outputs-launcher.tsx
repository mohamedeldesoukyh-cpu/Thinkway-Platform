"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import type { CampaignSeed } from "../hydration/hydration-types";
import type { StudioTab } from "../actions/campaign-workspace-message";
import { startCampaignOutputsFromSeed } from "../actions/generate-outputs-action";
import { GenerateOutputsEntry } from "./generate-outputs-entry";

export type GenerateOutputsLauncherProps = {
  /** The source normalized via the existing seed adapters. */
  seed: CampaignSeed;
  /** If the source already has a Campaign workspace, reuse it (no new campaign). */
  existingConversationId?: string;
  /** Deep-link into a mounted tab (defaults to the Outputs Center). */
  tab?: StudioTab;
  workspace?: { type?: string; id?: string };
  className?: string;
};

/**
 * Drop-in launcher for any business page. It shows what will hydrate (via the
 * existing GenerateOutputsEntry), then opens the Campaign workspace through the
 * existing server action — creating one conversation + hydrating the Campaign
 * Object, or reusing the existing one. No duplicate logic; navigation only.
 */
export function GenerateOutputsLauncher({
  seed,
  existingConversationId,
  tab = "outputs",
  workspace,
  className,
}: GenerateOutputsLauncherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const launch = () => {
    startTransition(async () => {
      setError(null);
      const result = await startCampaignOutputsFromSeed({ seed, existingConversationId, tab, workspace });
      if (result.ok) router.push(result.href);
      else setError(result.message);
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <GenerateOutputsEntry seed={seed} onGenerate={pending ? undefined : launch} />
      {pending ? (
        <p className="text-[11px] text-muted-foreground">Opening the campaign workspace…</p>
      ) : null}
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
    </div>
  );
}
