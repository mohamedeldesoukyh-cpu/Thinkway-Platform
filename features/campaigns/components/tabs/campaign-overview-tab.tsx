"use client";

import { InfoIcon, PencilIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignIntelligenceReference } from "@/features/campaigns/components/campaign-intelligence-reference";
import { CampaignOperationalReadinessChecklist } from "@/features/campaigns/components/campaign-operational-readiness-checklist";
import { CampaignPoSection } from "@/features/campaigns/components/campaign-po-section";
import { CampaignHeaderInlineEditor } from "@/features/campaigns/components/campaign-header-inline-editor";
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
  teams: _teams,
  groups: _groups,
  currencyOptions,
  onOpenDetails,
}: CampaignOverviewTabProps) {
  const [inlineEditing, setInlineEditing] = useState(false);
  const currency = workspace.currency_code;
  const operationalReadiness = useMemo(
    () => evaluateCampaignOperationalReadiness(workspace, assignmentHierarchy),
    [workspace, assignmentHierarchy]
  );

  return (
    <>
      <div className="space-y-0">
        <CampaignOperationalReadinessChecklist readiness={operationalReadiness} />

        <div className="thinkway-aurora-sechead">
          <div className="thinkway-aurora-sechead-tt">Details</div>
          <div className="thinkway-aurora-sechead-tools">
            {onOpenDetails ? (
              <Button
                variant="outline"
                size="sm"
                className="thinkway-campaign-btn h-[33px] px-3 text-[12.5px]"
                onClick={onOpenDetails}
              >
                <InfoIcon data-icon="inline-start" className="size-3.5" />
                Details panel
              </Button>
            ) : null}
            {!inlineEditing ? (
              <Button
                variant="outline"
                size="sm"
                className="thinkway-campaign-btn h-[33px] px-3 text-[12.5px]"
                onClick={() => setInlineEditing(true)}
              >
                <PencilIcon data-icon="inline-start" className="size-3.5" />
                Edit header
              </Button>
            ) : null}
          </div>
        </div>

        <CampaignHeaderInlineEditor
          workspace={workspace}
          accountManagers={accountManagers}
          editing={inlineEditing}
          onEditingChange={setInlineEditing}
        />
        {!inlineEditing ? (
          <CampaignOverviewDetails workspace={workspace} layout="grid" />
        ) : null}

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
    </>
  );
}
