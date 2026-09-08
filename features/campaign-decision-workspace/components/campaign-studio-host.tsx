"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CampaignStudioInput,
  CampaignStudioLayoutMode,
  CampaignStudioViewportMode,
} from "@/features/campaign-studio/types/campaign-studio";
import { cn } from "@/lib/utils";

import { DiscoveryCreatorDetailHost } from "@/features/discovery/components/discovery-creator-detail-host";
import type { CreatorDrawerSelection } from "./creator-drawer";
import { DecisionRightPanel } from "./decision-right-panel";
import { ScenarioBar } from "./scenario-bar";
import { StudioModeToggle, type StudioWorkspaceMode } from "./studio-mode-toggle";
import { useDecisionWorkspace } from "../hooks/use-decision-workspace";
import { applyScenarioToCampaignObject } from "../services/promote-scenario";
import type { CampaignStudioDecisionMode } from "../types/studio-decision-mode";

const CampaignStudio = dynamic(
  () =>
    import("@/features/campaign-studio/components/campaign-studio").then((m) => ({
      default: m.CampaignStudio,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
        Loading Campaign Studio…
      </div>
    ),
  }
);

type CampaignStudioHostProps = CampaignStudioInput & {
  conversationId?: string;
  messageId?: string;
  onCardUpdated?: (cardId: string, status: string) => void;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  onSlateUpdated?: (campaignObject: Record<string, unknown>) => void;
  onCampaignObjectPromoted?: (campaignObject: CampaignObject) => void;
  className?: string;
  layoutMode?: CampaignStudioLayoutMode;
  viewportMode?: CampaignStudioViewportMode;
  scrollContainer?: HTMLElement | null;
  /** Controlled workspace mode (panel owns Studio vs Decision tabs). */
  workspaceMode?: StudioWorkspaceMode;
  onWorkspaceModeChange?: (mode: StudioWorkspaceMode) => void;
  /** Hide Presentation | Decision toggle when parent panel owns mode tabs. */
  hideModeToggle?: boolean;
  /** Parent Campaign Mode panel owns mast + mode tabs. */
  hideTopChrome?: boolean;
};

function isWorkflowComplete(workflowStatus?: string): boolean {
  return workflowStatus === "complete" || workflowStatus === "completed";
}

function sectionsReadyForDecision(campaignObject?: CampaignObject | null): boolean {
  const sections = campaignObject?.sections;
  if (!sections) return false;
  const values = Object.values(sections);
  if (values.length === 0) return false;
  const complete = values.filter((section) => section.status === "complete").length;
  return complete >= values.length;
}

export function CampaignStudioHost(props: CampaignStudioHostProps) {
  const metaStatus =
    props.campaignObject &&
    typeof (props.campaignObject as { meta?: { workflowStatus?: string } }).meta
      ?.workflowStatus === "string"
      ? (props.campaignObject as { meta?: { workflowStatus?: string } }).meta
          ?.workflowStatus
      : undefined;
  const decisionReady = Boolean(
    props.campaignObject &&
      (isWorkflowComplete(props.workflowStatus) ||
        isWorkflowComplete(metaStatus) ||
        sectionsReadyForDecision(props.campaignObject))
  );
  const [internalMode, setInternalMode] = useState<StudioWorkspaceMode>("presentation");
  const mode = props.workspaceMode ?? internalMode;
  const setMode = props.onWorkspaceModeChange ?? setInternalMode;

  useEffect(() => {
    if (props.workspaceMode) setInternalMode(props.workspaceMode);
  }, [props.workspaceMode]);

  const modeToggle = props.hideModeToggle ? null : (
    <StudioModeToggle
      mode={mode}
      onModeChange={setMode}
      decisionDisabled={!decisionReady}
    />
  );

  if (!decisionReady || mode === "presentation") {
    const {
      className,
      conversationId,
      messageId,
      onCardUpdated,
      onVendorDecisionsUpdated,
      onSlateUpdated,
      layoutMode = "chat",
      scrollContainer,
      viewportMode = "default",
      workspaceMode: _wm,
      onWorkspaceModeChange: _owm,
      hideModeToggle: _hmt,
      hideTopChrome = false,
      ...studioInput
    } = props;
    return (
      <div
        className={cn(
          layoutMode === "panel" ? "flex min-h-0 flex-1 flex-col" : "space-y-2",
          className
        )}
      >
        {!decisionReady && viewportMode !== "desktop" && !props.hideModeToggle ? (
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
          onSlateUpdated={onSlateUpdated}
          studioModeToggle={modeToggle}
          layoutMode={layoutMode}
          viewportMode={viewportMode}
          scrollContainer={scrollContainer}
          hideTopChrome={hideTopChrome}
          className={layoutMode === "panel" ? "h-full min-h-0" : undefined}
        />
      </div>
    );
  }

  return (
    <CampaignStudioDecisionHost
      {...props}
      modeToggle={modeToggle}
      initialMode={mode}
      onModeChange={setMode}
    />
  );
}

function CampaignStudioDecisionHost({
  conversationId,
  messageId,
  onCardUpdated,
  onVendorDecisionsUpdated,
  onSlateUpdated,
  onCampaignObjectPromoted,
  className,
  campaignObject,
  modeToggle,
  initialMode,
  onModeChange,
  layoutMode = "chat",
  scrollContainer,
  viewportMode = "default",
  hideModeToggle: _hideModeToggle,
  hideTopChrome = false,
  workspaceMode: _workspaceMode,
  onWorkspaceModeChange: _onWorkspaceModeChange,
  ...studioInput
}: CampaignStudioHostProps & {
  modeToggle: ReactNode;
  initialMode: StudioWorkspaceMode;
  onModeChange: (mode: StudioWorkspaceMode) => void;
}) {
  const [mode, setMode] = useState<StudioWorkspaceMode>(initialMode);
  const [budgetSlider, setBudgetSlider] = useState(0);
  const [drawerCreator, setDrawerCreator] = useState<CreatorDrawerSelection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [promotedObject, setPromotedObject] = useState<CampaignObject | undefined>();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

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

  const setWorkspaceMode = (next: StudioWorkspaceMode) => {
    setMode(next);
    onModeChange(next);
  };

  const toggle = _hideModeToggle
    ? null
    : modeToggle ?? (
        <StudioModeToggle mode={mode} onModeChange={setWorkspaceMode} />
      );

  if (mode === "presentation") {
    return (
      <div className={cn(hideTopChrome ? "flex min-h-0 flex-1 flex-col" : "space-y-3", className)}>
        {toggle ? <div className="flex justify-end">{toggle}</div> : null}
        <CampaignStudio
          {...studioInput}
          campaignObject={sourceCampaignObject}
          conversationId={conversationId}
          messageId={messageId}
          onCardUpdated={onCardUpdated}
          onVendorDecisionsUpdated={onVendorDecisionsUpdated}
          onSlateUpdated={onSlateUpdated}
          layoutMode={layoutMode}
          viewportMode={viewportMode}
          scrollContainer={scrollContainer}
          hideTopChrome={hideTopChrome}
        />
      </div>
    );
  }

  return (
    <div className={cn(hideTopChrome ? "flex min-h-0 flex-1 flex-col gap-3" : "space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <ScenarioBar workspace={workspace} className="min-w-0 flex-1" />
        {toggle}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 items-start gap-4">
        <div className="min-h-0 min-w-0 flex-1 space-y-3">
          <CampaignStudio
            {...studioInput}
            campaignObject={displayCampaignObject}
            conversationId={conversationId}
            messageId={messageId}
            onCardUpdated={onCardUpdated}
            onVendorDecisionsUpdated={onVendorDecisionsUpdated}
            onSlateUpdated={onSlateUpdated}
            decisionMode={decisionMode}
            layoutMode={layoutMode}
            scrollContainer={scrollContainer}
            viewportMode={viewportMode}
            hideTopChrome={hideTopChrome}
          />

          <DecisionRightPanel workspace={workspace} variant="stacked" className="xl:hidden" />
        </div>

        <DecisionRightPanel workspace={workspace} />
      </div>

      <DiscoveryCreatorDetailHost
        selection={drawerCreator}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
