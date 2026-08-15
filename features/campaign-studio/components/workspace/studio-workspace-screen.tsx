"use client";

import type { ReactNode } from "react";
import { FileSpreadsheetIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { StudioDraftState } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStudioDecisionMode } from "@/features/campaign-decision-workspace/types/studio-decision-mode";

import type { StudioWorkspaceStepId } from "../../constants/studio-workspace";
import type {
  CampaignStudioLayoutMode,
  CampaignStudioSection,
  CampaignStudioViewportMode,
} from "../../types/campaign-studio";
import type { StudioWorkspaceStepView } from "../../services/studio-workspace-status";
import { StudioSectionCard } from "../campaign-studio-sections";
import { IntakeScreen } from "./intake-screen";
import { CreatorsMixHeader } from "./creators-mix-header";
import { PackageScreen } from "./package-screen";
import { StudioStepShell } from "./studio-step-shell";

type StudioWorkspaceScreenProps = {
  step: StudioWorkspaceStepView;
  sections: CampaignStudioSection[];
  campaignObject?: CampaignObject;
  conversationId?: string;
  messageId?: string;
  outdatedSections: ReadonlySet<CampaignStudioSection["id"]>;
  decisionMode?: CampaignStudioDecisionMode;
  studioDraft?: StudioDraftState;
  onStudioDraftUpdated?: (draft: StudioDraftState) => void;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  onSlateUpdated?: (campaignObject: Record<string, unknown>) => void;
  onNavigateStep?: (stepId: StudioWorkspaceStepId) => void;
  appliedRemovedCreatorIds?: string[];
  layoutMode?: CampaignStudioLayoutMode;
  viewportMode?: CampaignStudioViewportMode;
  budgetFooter?: ReactNode;
  workflowStatus?: string;
  workflowProgressPercent?: number;
};

function renderSection(
  section: CampaignStudioSection | undefined,
  props: Omit<StudioWorkspaceScreenProps, "step" | "sections">,
  footer?: ReactNode
) {
  if (!section) return null;
  return (
    <StudioSectionCard
      key={section.id}
      section={section}
      campaignObject={props.campaignObject}
      chrome="plain"
      forceMountBody
      outdated={props.outdatedSections.has(section.id)}
      decisionMode={section.id === "creator-recommendations" ? props.decisionMode : undefined}
      conversationId={props.conversationId}
      messageId={props.messageId}
      onVendorDecisionsUpdated={props.onVendorDecisionsUpdated}
      onSlateUpdated={props.onSlateUpdated}
      studioDraft={props.studioDraft}
      onStudioDraftUpdated={props.onStudioDraftUpdated}
      appliedRemovedCreatorIds={props.appliedRemovedCreatorIds}
      layoutMode={props.layoutMode}
      viewportMode={props.viewportMode}
      sectionFooter={footer}
    />
  );
}

export function StudioWorkspaceScreen(props: StudioWorkspaceScreenProps) {
  const { step, sections } = props;
  const byId = new Map(sections.map((section) => [section.id, section]));

  if (step.id === "intake") {
    return (
      <StudioStepShell step={step}>
        <IntakeScreen
          campaignObject={props.campaignObject}
          conversationId={props.conversationId}
          messageId={props.messageId}
          onCampaignObjectUpdated={props.onSlateUpdated}
          onNavigateStep={props.onNavigateStep}
          workflowStatus={props.workflowStatus}
          workflowProgressPercent={props.workflowProgressPercent}
        />
      </StudioStepShell>
    );
  }

  if (step.id === "creators") {
    return (
      <StudioStepShell step={step}>
        <CreatorsMixHeader
          campaignObject={props.campaignObject}
          discoveryStatus={byId.get("creator-discovery")?.status ?? "pending"}
        />
        {renderSection(byId.get("creator-discovery"), props)}
        {renderSection(byId.get("creator-recommendations"), props)}
      </StudioStepShell>
    );
  }

  if (step.id === "commercial") {
    return (
      <StudioStepShell
        step={step}
        actions={
          <Button
            type="button"
            className="bg-[#0057FF] hover:bg-[#0040CC]"
            onClick={() =>
              toast.message("Build quotation continues after Package.", {
                description:
                  "Commercial stays on the existing engine. Create Client Review is the next product bridge.",
              })
            }
          >
            <FileSpreadsheetIcon className="size-4" />
            Build quotation
          </Button>
        }
      >
        {renderSection(byId.get("budget-planner"), props)}
      </StudioStepShell>
    );
  }

  if (step.id === "package") {
    return (
      <StudioStepShell step={step}>
        <PackageScreen
          campaignObject={props.campaignObject}
          conversationId={props.conversationId}
          outdatedSections={props.outdatedSections}
          sectionStatuses={Object.fromEntries(sections.map((section) => [section.id, section.status]))}
          onCampaignObjectUpdated={props.onSlateUpdated}
          onNavigateStep={props.onNavigateStep}
          timeline={renderSection(byId.get("timeline"), props)}
          presentation={renderSection(byId.get("presentation-status"), props)}
        />
      </StudioStepShell>
    );
  }

  const sectionId =
    step.id === "strategy"
      ? "executive-strategy"
      : step.id === "content"
        ? "content-plan"
        : null;

  return (
    <StudioStepShell step={step}>
      {sectionId ? renderSection(byId.get(sectionId), props) : null}
    </StudioStepShell>
  );
}

export type { StudioWorkspaceStepId };
