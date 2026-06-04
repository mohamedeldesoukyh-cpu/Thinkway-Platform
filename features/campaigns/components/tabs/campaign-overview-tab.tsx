"use client";

import { InfoIcon, PencilIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignPoSection } from "@/features/campaigns/components/campaign-po-section";
import { CampaignEditSheet } from "@/features/campaigns/components/campaign-edit-sheet";
import { CampaignOverviewDetails } from "@/features/campaigns/components/campaign-overview-details";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

type CampaignOverviewTabProps = {
  workspace: CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  currencyOptions: { value: string; label: string }[];
  onOpenDetails?: () => void;
};

export function CampaignOverviewTab({
  workspace,
  accountManagers,
  teams,
  currencyOptions,
  onOpenDetails,
}: CampaignOverviewTabProps) {
  const [editOpen, setEditOpen] = useState(false);
  const currency = workspace.currency_code;

  return (
    <>
      <div className={cn("space-y-4", OPERATIONAL_TABLE_FONT)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {onOpenDetails ? (
            <Button variant="outline" size="sm" onClick={onOpenDetails}>
              <InfoIcon data-icon="inline-start" />
              Campaign details panel
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <PencilIcon data-icon="inline-start" />
            Edit campaign
          </Button>
        </div>

        <CampaignOverviewDetails workspace={workspace} layout="grid" compactTypography />

        <CampaignPoSection
          campaignId={workspace.id}
          campaignCurrency={currency}
          po={workspace.po}
          currencyOptions={currencyOptions}
        />

        {workspace.brief ? (
          <CampaignFlatSection title="Brief">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{workspace.brief}</p>
          </CampaignFlatSection>
        ) : null}
      </div>

      <CampaignEditSheet
        workspace={workspace}
        accountManagers={accountManagers}
        teams={teams}
        currencyOptions={currencyOptions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
