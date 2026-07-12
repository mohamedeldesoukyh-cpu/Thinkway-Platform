"use client";

import { FileTextIcon, InfoIcon, PencilIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignIntelligenceReference } from "@/features/campaigns/components/campaign-intelligence-reference";
import { CampaignOperationalReadinessChecklist } from "@/features/campaigns/components/campaign-operational-readiness-checklist";
import { CampaignPoSection } from "@/features/campaigns/components/campaign-po-section";
import { CampaignEditSheet } from "@/features/campaigns/components/campaign-edit-sheet";
import { CampaignOverviewDetails } from "@/features/campaigns/components/campaign-overview-details";
import { ClientIoCampaignChrome } from "@/features/io/components/client-io-campaign-chrome";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import { evaluateCampaignOperationalReadiness } from "@/lib/domains/commercial/campaign-operational-readiness";

type CampaignOverviewTabProps = {
  workspace: CampaignWorkspace;
  assignmentHierarchy: AssignmentHierarchy;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  groups: { id: string; name: string; document_number: string }[];
  currencyOptions: { value: string; label: string }[];
  onOpenDetails?: () => void;
};

export function CampaignOverviewTab({
  workspace,
  assignmentHierarchy,
  accountManagers,
  teams,
  groups,
  currencyOptions,
  onOpenDetails,
}: CampaignOverviewTabProps) {
  const [editOpen, setEditOpen] = useState(false);
  const currency = workspace.currency_code;
  const operationalReadiness = useMemo(
    () => evaluateCampaignOperationalReadiness(workspace, assignmentHierarchy),
    [workspace, assignmentHierarchy]
  );

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[var(--camp-text)]">Campaign overview</h2>
          <p className="text-[11px] text-[var(--camp-text-3)]">
            Header, hierarchy, commercial, and insertion order
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {onOpenDetails ? (
            <Button
              variant="outline"
              size="sm"
              className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
              onClick={onOpenDetails}
            >
              <InfoIcon data-icon="inline-start" className="size-3.5" />
              Details panel
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
            onClick={() => setEditOpen(true)}
          >
            <PencilIcon data-icon="inline-start" className="size-3.5" />
            Edit campaign
          </Button>
        </div>
      </div>

      <div className="space-y-3.5">
        <CampaignOperationalReadinessChecklist readiness={operationalReadiness} />

        <CampaignOverviewDetails workspace={workspace} layout="grid" />

        <CampaignFlatSection
          title="Client IO"
          description="Generate, view, and send the client-facing insertion order for this campaign."
          actions={<ClientIoCampaignChrome io={workspace.client_io} campaignId={workspace.id} />}
        >
          {!workspace.client_io ? (
            <p className="text-[12px] leading-snug text-[var(--camp-text-3)]">
              Set up the client insertion order before generating or sending to the legal entity.
            </p>
          ) : null}
        </CampaignFlatSection>

        <CampaignPoSection
          campaignId={workspace.id}
          campaignName={workspace.name}
          campaignCurrency={currency}
          po={workspace.po}
          currencyOptions={currencyOptions}
        />

        <CampaignIntelligenceReference workspace={workspace} />

        {workspace.brief && !workspace.campaign_intelligence ? (
          <CampaignFlatSection title="Brief">
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--camp-text-2)]">
              {workspace.brief}
            </p>
          </CampaignFlatSection>
        ) : null}
      </div>

      <CampaignEditSheet
        workspace={workspace}
        accountManagers={accountManagers}
        teams={teams}
        groups={groups}
        currencyOptions={currencyOptions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
