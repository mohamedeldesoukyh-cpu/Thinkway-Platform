"use client";

import { InfoIcon, PencilIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignPoSection } from "@/features/campaigns/components/campaign-po-section";
import { CampaignEditSheet } from "@/features/campaigns/components/campaign-edit-sheet";
import { CampaignOverviewDetails } from "@/features/campaigns/components/campaign-overview-details";
import type { CampaignWorkspace } from "@/features/campaigns/types";

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
      <div className="space-y-4">
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

        <CampaignOverviewDetails workspace={workspace} layout="grid" />

        <CampaignPoSection
          campaignId={workspace.id}
          campaignCurrency={currency}
          po={workspace.po}
          currencyOptions={currencyOptions}
        />

        {workspace.brief ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Brief</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {workspace.brief}
              </p>
            </CardContent>
          </Card>
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
