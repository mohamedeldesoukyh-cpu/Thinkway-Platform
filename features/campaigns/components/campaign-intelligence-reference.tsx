"use client";

import Link from "next/link";
import { BrainIcon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import type { CampaignWorkspace } from "@/features/campaigns/types";

type Props = {
  workspace: CampaignWorkspace;
};

export function CampaignIntelligenceReference({ workspace }: Props) {
  const intelligence = workspace.campaign_intelligence;
  if (!intelligence) return null;

  return (
    <CampaignFlatSection
      title="Campaign intelligence"
      description="Linked brief intelligence — shared across Discovery, Studio, and AI workflows."
      actions={
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-[11px]" asChild>
            <Link href={intelligence.searchUrl}>
              <BrainIcon className="size-3" />
              Creator Search
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" asChild>
            <Link href={intelligence.libraryUrl}>
              <ExternalLinkIcon className="size-3" />
              Library
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--camp-text)]">{intelligence.title}</p>
        {intelligence.requirementsSummary ? (
          <p className="line-clamp-6 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--camp-text-2)]">
            {intelligence.requirementsSummary}
          </p>
        ) : (
          <p className="text-[12px] text-[var(--camp-text-3)]">
            Intelligence record linked. Open Creator Search to review full requirements.
          </p>
        )}
      </div>
    </CampaignFlatSection>
  );
}
