"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignStudio } from "@/features/campaign-studio/components/campaign-studio";
import type { CampaignStudioInput } from "@/features/campaign-studio/types/campaign-studio";
import { cn } from "@/lib/utils";

import { CreatorDrawer, type CreatorDrawerSelection } from "./creator-drawer";
import { DecisionRightPanel } from "./decision-right-panel";
import { ScenarioBar } from "./scenario-bar";
import { StudioModeToggle, type StudioWorkspaceMode } from "./studio-mode-toggle";
import { useDecisionWorkspace } from "../hooks/use-decision-workspace";
import { applyScenarioToCampaignObject } from "../services/promote-scenario";
import type { CampaignStudioDecisionMode } from "../types/studio-decision-mode";

type CampaignStudioHostProps = CampaignStudioInput & {
  conversationId?: string;
  messageId?: string;
  onCardUpdated?: (cardId: string, status: string) => void;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  onCampaignObjectPromoted?: (campaignObject: CampaignObject) => void;
  className?: string;
};

function isWorkflowComplete(workflowStatus?: string): boolean {
  return workflowStatus === "complete" || workflowStatus === "completed";
}

export function CampaignStudioHost(props: CampaignStudioHostProps) {
  const decisionReady = Boolean(props.campaignObject && isWorkflowComplete(props.workflowStatus));
  const [mode, setMode] = useState<StudioWorkspaceMode>("presentation");

  const modeToggle = (
    <StudioModeToggle
      mode={mode}
      onModeChange={setMode}
      decisionDisabled={!decisionReady}
    />
  );

  if (!decisionReady || mode === "presentation") {
    const { className, conversationId, messageId, onCardUpdated, onVendorDecisionsUpdated, ...studioInput } =
      props;
    return (
      <div className={cn("space-y-2", className)}>
        {!decisionReady ? (
          <p className="text-right text-[10px] text-muted-foreground">
            Decision Mode unlocks when the studio workflow completes.
          </p>
        ) : null}
        <CampaignStudio
          {...studioInput}
          conversationId={conversationId}
          messageId={messageId}
          onCardUpdated={onCardUpdated}
          onVendorDecisionsUpdated={onVendorDecisionsUpdated}
          studioModeToggle={modeToggle}
        />
      </div>
    );
  }

  return <CampaignStudioDecisionHost {...props} modeToggle={modeToggle} initialMode={mode} />;
}

function CampaignStudioDecisionHost({
  conversationId,
  messageId,
  onCardUpdated,
  onVendorDecisionsUpdated,
  onCampaignObjectPromoted,
  className,
  campaignObject,
  modeToggle,
  initialMode,
  ...studioInput
}: CampaignStudioHostProps & {
  modeToggle: ReactNode;
  initialMode: StudioWorkspaceMode;
}) {
  const [mode, setMode] = useState<StudioWorkspaceMode>(initialMode);
  const [budgetSlider, setBudgetSlider] = useState(0);
  const [drawerCreator, setDrawerCreator] = useState<CreatorDrawerSelection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [promotedObject, setPromotedObject] = useState<CampaignObject | undefined>();

  const sourceCampaignObject = promotedObject ?? campaignObject!;

  const frozenCampaignRef = useRef(sourceCampaignObject);
  frozenCampaignRef.current = sourceCampaignObject;

  const workspace = useDecisionWorkspace({
    campaignObject: sourceCampaignObject,
    conversationId: conversationId ?? "",
    onCampaignObjectPromoted: (next) => {
      frozenCampaignRef.current = next;
      setPromotedObject(next);
      onCampaignObjectPromoted?.(next);
    },
  });

  const displayCampaignObject =
    workspace.selectedScenario?.isOriginal
      ? sourceCampaignObject
      : (() => {
          try {
            return applyScenarioToCampaignObject(
              sourceCampaignObject,
              workspace.selectedScenario!
            );
          } catch {
            return sourceCampaignObject;
          }
        })();

  const handleBudgetChange = useCallback(
    (value: number) => {
      setBudgetSlider(value);
      workspace.applyBudgetChange(value);
    },
    [workspace]
  );

  const handleCreatorClick = useCallback((creator: CreatorDrawerSelection) => {
    setDrawerCreator(creator);
    setDrawerOpen(true);
  }, []);

  const creators =
    workspace.selectedScenario?.simulationResult.creators.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      handle: c.handle,
    })) ?? [];

  const decisionMode: CampaignStudioDecisionMode = {
    budgetSlider: { value: budgetSlider, onChange: handleBudgetChange },
    onCreatorClick: handleCreatorClick,
    onCreatorAction: workspace.applyCreatorAction,
    creators,
    clientCreatorAssessments: workspace.clientCreatorAssessments,
    evaluateClientCreatorUrls: workspace.evaluateClientCreatorUrls,
  };

  const toggle = (
    <StudioModeToggle mode={mode} onModeChange={setMode} />
  );

  if (mode === "presentation") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex justify-end">{toggle}</div>
        <CampaignStudio
          {...studioInput}
          campaignObject={sourceCampaignObject}
          conversationId={conversationId}
          messageId={messageId}
          onCardUpdated={onCardUpdated}
          onVendorDecisionsUpdated={onVendorDecisionsUpdated}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScenarioBar workspace={workspace} className="min-w-0 flex-1" />
        {toggle}
      </div>

      <div className="flex min-w-0 items-start gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <CampaignStudio
            {...studioInput}
            campaignObject={displayCampaignObject}
            conversationId={conversationId}
            messageId={messageId}
            onCardUpdated={onCardUpdated}
            onVendorDecisionsUpdated={onVendorDecisionsUpdated}
            decisionMode={decisionMode}
          />

          <DecisionRightPanel workspace={workspace} variant="stacked" className="xl:hidden" />
        </div>

        <DecisionRightPanel workspace={workspace} />
      </div>

      <CreatorDrawer creator={drawerCreator} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
