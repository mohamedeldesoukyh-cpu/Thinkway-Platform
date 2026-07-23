"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircleIcon,
  FileTextIcon,
  GripVerticalIcon,
  LayoutGridIcon,
  Loader2Icon,
  RefreshCwIcon,
  XIcon,
  ZapIcon,
  CalendarIcon,
  UserIcon,
  ColumnsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  OUTPUTS_CLASSES,
  OUTPUTS_GROUP_LABEL_STEP,
  OUTPUTS_SECTION_NAV_HEIGHT,
} from "../constants/outputs-center-tokens";
import "../styles/outputs-center-ref.css";
import { OutputsSectionNav } from "./outputs-section-nav";
import { OutputsGroupLabel } from "./outputs-group-label";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignBriefViewer } from "@/features/campaign-studio/components/sections/campaign-brief-viewer";
import { hasCampaignBriefText } from "@/features/campaign-outputs/brief-media-plan-schedule";

import type { CampaignOutputContent, CampaignOutputGroup, CampaignOutputKind } from "../output-types";
import type { OutputView } from "../output-registry";
import { OUTPUT_GROUPS } from "../output-catalog";
import { getOutputContentForDisplay } from "../output-registry";
import { OutputCard, type OutputCardActions } from "./output-card";
import { CampaignBriefCard } from "@/features/campaign-studio/components/sections/campaign-brief-card";
import { OutputViewer } from "./output-viewer";
import { OutputDocumentPreview } from "./output-document-preview";
import { MediaPlanExportDialog } from "./media-plan-export-dialog";
import { MediaPlanPresentationToggle } from "./media-plan-presentation-toggle";
import { MediaPlanSectionVisibilityPanel } from "./media-plan-section-visibility-panel";
import { updateMediaPlanPresentationAction } from "../actions/update-media-plan-presentation";
import { useResizableDocumentWindow } from "../hooks/use-resizable-document-window";
import { resolveMediaPlanCampaignContext } from "../generators/media-plan";
import type { MediaPlanCampaignContext, MediaPlanData } from "../generators/media-plan";
import { mergeMediaPlanContext } from "./media-plan-context-merge";
import {
  DocumentPreviewWindow,
  type PreviewWindowState,
} from "./document-preview-window";
import { MediaPlanPreviewPanelHeader } from "./media-plan-preview-panel-header";
import { resolveMediaPlanContextForPreview } from "../actions/resolve-media-plan-context";
import { updateMediaPlanScheduleAction } from "../actions/update-media-plan-schedule";
import { updateCampaignMarketIntelligenceAction } from "../actions/update-campaign-market-intelligence";
import { updateInfluencerConceptsAction } from "../actions/update-influencer-concepts";
import type { MediaPlanMarketIntelligenceMeta } from "@/features/market-intelligence/market-intelligence-config";
import type { MediaPlanCreatorMoveTarget } from "./media-plan-calendar";
import { OutputsCenterMarketIntelligenceToggle } from "./outputs-center-market-intelligence-toggle";
import {
  applyMediaPlanPresentationPatch,
  readMediaPlanPresentation,
  type MediaPlanPresentationPatch,
  type MediaPlanSectionKey,
} from "../media-plan-presentation";

const GROUP_ICONS: Record<CampaignOutputGroup, LucideIcon> = {
  strategy: ZapIcon,
  planning: CalendarIcon,
  client: UserIcon,
  internal: ColumnsIcon,
};

export type OutputsCenterProps = {
  /** Live campaign object — used for instant Media Plan context without a server roundtrip. */
  campaignObject?: CampaignObject;
  /** All output views (any order) — grouped internally by the metadata-driven group. */
  outputs: OutputView[];
  /** Output currently being generated/regenerated via Copilot. */
  generatingKind?: CampaignOutputKind | null;
  /** Resolve the rendered content for the Open/Preview panel. */
  getContent?: (kind: OutputView["kind"]) => CampaignOutputContent | undefined;
  /** Required for Media Plan file export from the preview panel. */
  campaignObjectId?: string;
  conversationId?: string;
  /** Called after a manual media plan schedule save so the studio can refresh. */
  onCampaignObjectUpdated?: (campaignObject: CampaignObject) => void;
  /** Studio message id — enables brief edit from the brief card. */
  messageId?: string;
  /** Called when the campaign brief is saved from the Outputs grid card. */
  onBriefApplied?: (campaignObject: Record<string, unknown>) => void;
  actions?: OutputCardActions;
  className?: string;
  /** True while a batch stale-output regeneration is running. */
  regeneratingAll?: boolean;
  /** Regenerate every stale output in catalog order. */
  onRegenerateAllStale?: () => void;
  /** Error from the last batch regeneration attempt. */
  regenerateAllError?: string | null;
  /** Disable batch regeneration (e.g. while Copilot is streaming). */
  regenerateAllDisabled?: boolean;
  /** Amber plan-readiness alert — rendered above up-next cards (reference order). */
  planReadinessBanner?: ReactNode;
  /** Execution Campaign + Quotation launcher row. */
  upNextCards?: ReactNode;
};

function summarizeStaleCause(outputs: OutputView[]): string {
  const stale = outputs.filter((output) => output.status === "needs_update");
  const reasons = stale
    .map((output) => output.staleReason?.replace(/\.$/, "").trim())
    .filter((reason): reason is string => Boolean(reason));

  if (reasons.length === 0) return "after campaign inputs changed";

  const normalized = reasons.map((reason) => reason.toLowerCase());
  const allBrief = normalized.every((reason) => reason.includes("campaign brief changed"));
  if (allBrief) return "after the campaign brief changed";

  const first = reasons[0]!;
  if (reasons.every((reason) => reason === first)) {
    return `after ${first.charAt(0).toLowerCase()}${first.slice(1)}`;
  }

  return "after campaign inputs changed";
}

type PanelState = {
  kind: OutputView["kind"];
  mode: "open" | "preview";
};

/**
 * The Campaign Outputs Center — a first-class platform page. An asset library
 * for the campaign: every generated artifact as a rich card, grouped by the
 * metadata-driven Strategy / Planning / Client / Internal buckets, with an
 * inline preview panel. It consumes outputs (derived from the Campaign Object);
 * it never owns campaign data.
 */
export function OutputsCenter({
  campaignObject,
  outputs,
  generatingKind,
  getContent,
  campaignObjectId,
  conversationId,
  onCampaignObjectUpdated,
  messageId,
  onBriefApplied,
  actions,
  className,
  regeneratingAll = false,
  onRegenerateAllStale,
  regenerateAllError,
  regenerateAllDisabled = false,
  planReadinessBanner,
  upNextCards,
}: OutputsCenterProps) {
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [briefViewerOpen, setBriefViewerOpen] = useState(false);
  const [mediaPlanEditMode, setMediaPlanEditMode] = useState(false);
  const [previewWindowState, setPreviewWindowState] = useState<PreviewWindowState>("normal");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [presentationSaving, setPresentationSaving] = useState(false);
  const [marketIntelligenceSaving, setMarketIntelligenceSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const effectiveCampaignObject = campaignObject;
  const presentationSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presentationSaveInFlightRef = useRef(false);
  const pendingPresentationPatchRef = useRef<MediaPlanPresentationPatch | null>(null);

  const grouped = useMemo(() => {
    const order = OUTPUT_GROUPS.map((g) => g.group);
    const labelOf = new Map(OUTPUT_GROUPS.map((g) => [g.group, g.label] as const));
    return order
      .map((group: CampaignOutputGroup) => ({
        group,
        label: labelOf.get(group) ?? group,
        outputs: outputs.filter((o) => o.group === group),
      }))
      .filter((section) => section.outputs.length > 0);
  }, [outputs]);

  const counts = useMemo(() => {
    const generated = outputs.filter((o) => o.status !== "not_generated").length;
    const stale = outputs.filter((o) => o.status === "needs_update").length;
    const regeneratableStale = outputs.filter(
      (o) => o.status === "needs_update" && o.generatable
    ).length;
    return { generated, stale, regeneratableStale, total: outputs.length };
  }, [outputs]);

  const staleCause = useMemo(() => summarizeStaleCause(outputs), [outputs]);

  const panelContent = useMemo(() => {
    if (!panel || !getContent) return undefined;
    if (panel.kind === "media_plan" && effectiveCampaignObject) {
      return getOutputContentForDisplay(effectiveCampaignObject, "media_plan");
    }
    return getContent(panel.kind);
  }, [panel?.kind, panel?.mode, getContent, effectiveCampaignObject?.id, effectiveCampaignObject?.meta.campaignOutputs]);

  const isMediaPlanPanel = panel?.kind === "media_plan";
  const mediaPlanPresentation = useMemo(
    () =>
      effectiveCampaignObject ? readMediaPlanPresentation(effectiveCampaignObject) : undefined,
    [effectiveCampaignObject?.id, effectiveCampaignObject?.updatedAt, effectiveCampaignObject?.meta.mediaPlanPresentation]
  );
  const showMediaPlanSectionControls =
    isMediaPlanPanel &&
    !mediaPlanEditMode &&
    mediaPlanPresentation?.view !== "client";

  const liveMediaPlanContextFallback = useMemo<MediaPlanCampaignContext | undefined>(() => {
    if (!effectiveCampaignObject) return undefined;
    return resolveMediaPlanCampaignContext(effectiveCampaignObject);
  }, [
    effectiveCampaignObject?.id,
    effectiveCampaignObject?.meta.quotationCommercials?.syncedAt,
    effectiveCampaignObject?.meta.quotationCommercials?.creators?.length,
    effectiveCampaignObject?.meta.campaignFacts?.brandName,
    effectiveCampaignObject?.meta.campaignFacts?.clientName,
  ]);

  const liveMediaPlanContextFallbackKey = useMemo(
    () => JSON.stringify(liveMediaPlanContextFallback ?? null),
    [liveMediaPlanContextFallback]
  );

  const [liveMediaPlanContext, setLiveMediaPlanContext] = useState<
    MediaPlanCampaignContext | undefined
  >(undefined);

  useEffect(() => {
    if (!isMediaPlanPanel) {
      setLiveMediaPlanContext((prev) => (prev === undefined ? prev : undefined));
      return;
    }

    setLiveMediaPlanContext((prev) => {
      const next = liveMediaPlanContextFallback;
      if (prev === next) return prev;
      if (
        prev &&
        next &&
        JSON.stringify(prev) === JSON.stringify(next)
      ) {
        return prev;
      }
      return next;
    });

    if (!campaignObjectId || !conversationId) return;

    let cancelled = false;
    void resolveMediaPlanContextForPreview({ campaignObjectId, conversationId }).then((context) => {
      if (!cancelled && Object.keys(context).length > 0) {
        setLiveMediaPlanContext((prev) => {
          if (JSON.stringify(prev ?? null) === JSON.stringify(context)) return prev;
          return context;
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    isMediaPlanPanel,
    campaignObjectId,
    conversationId,
    liveMediaPlanContextFallbackKey,
  ]);

  const mergedActions = useMemo<OutputCardActions>(
    () => ({
      ...actions,
      onOpen: (kind) => {
        const targetKind =
          outputs.find((output) => output.kind === kind)?.linkedOutputKind ?? kind;
        setPreviewWindowState("normal");
        setPanel({ kind: targetKind, mode: "open" });
        actions?.onOpen?.(targetKind);
      },
      onPreview: (kind) => {
        setPreviewWindowState("normal");
        setPanel({ kind, mode: "preview" });
        actions?.onPreview?.(kind);
      },
    }),
    [actions, outputs]
  );

  const isFloatingPreview = panel?.mode === "preview" || isMediaPlanPanel;
  const isPreviewWindowOpen = Boolean(panel && isFloatingPreview);
  const isPreviewInteractive = Boolean(
    isPreviewWindowOpen &&
      !(isMediaPlanPanel && mediaPlanEditMode) &&
      previewWindowState === "normal"
  );
  const {
    bounds,
    hitTopClamp,
    isDragging,
    isResizing,
    panelRef,
    dragHandleProps,
    createResizeHandleProps,
  } = useResizableDocumentWindow(isPreviewWindowOpen, {
    wide: isMediaPlanPanel,
    interactive: isPreviewInteractive,
  });

  const mediaPlanPreviewContext = useMemo(() => {
    if (!isMediaPlanPanel || !panelContent) return undefined;
    const data = panelContent.data as MediaPlanData | undefined;
    return mergeMediaPlanContext(data?.campaignContext, liveMediaPlanContext);
  }, [isMediaPlanPanel, panelContent, liveMediaPlanContext]);

  const handleMoveMediaPlanCreator = useCallback(
    async (target: MediaPlanCreatorMoveTarget) => {
      if (!campaignObjectId || !conversationId) {
        setScheduleError("Connect this workspace to save schedule changes.");
        return;
      }

      setScheduleSaving(true);
      setScheduleError(null);

      const result = await updateMediaPlanScheduleAction({
        campaignObjectId,
        conversationId,
        move: {
          creatorId: target.creatorId,
          fromWeek: target.fromWeek,
          fromDayIndex: target.fromDayIndex,
          toWeek: target.toWeek,
          toDayIndex: target.toDayIndex,
          deliverableTypes: target.deliverableTypes,
          remainingTypes: target.remainingTypes,
        },
      });

      setScheduleSaving(false);

      if (!result.ok) {
        setScheduleError(result.message);
        return;
      }

      onCampaignObjectUpdated?.(result.campaignObject);
    },
    [campaignObjectId, conversationId, onCampaignObjectUpdated]
  );

  const flushPresentationSave = useCallback(async () => {
    const patch = pendingPresentationPatchRef.current;
    if (!patch || !campaignObjectId || !conversationId) return;

    pendingPresentationPatchRef.current = null;
    presentationSaveInFlightRef.current = true;
    setPresentationSaving(true);
    setScheduleError(null);

    const result = await updateMediaPlanPresentationAction({
      campaignObjectId,
      conversationId,
      presentation: patch,
    });

    presentationSaveInFlightRef.current = false;
    setPresentationSaving(false);

    if (!result.ok) {
      setScheduleError(result.message);
      return;
    }

    onCampaignObjectUpdated?.(result.campaignObject);
  }, [campaignObjectId, conversationId, onCampaignObjectUpdated]);

  const queuePresentationSave = useCallback(
    (patch: MediaPlanPresentationPatch) => {
      pendingPresentationPatchRef.current = {
        ...pendingPresentationPatchRef.current,
        ...patch,
        sections: {
          ...pendingPresentationPatchRef.current?.sections,
          ...patch.sections,
        },
      };

      if (presentationSaveTimerRef.current) {
        clearTimeout(presentationSaveTimerRef.current);
      }

      presentationSaveTimerRef.current = setTimeout(() => {
        presentationSaveTimerRef.current = null;
        void flushPresentationSave();
      }, patch.sections ? 400 : 0);
    },
    [flushPresentationSave]
  );

  const applyPresentationPatchOptimistic = useCallback(
    (patch: MediaPlanPresentationPatch) => {
      if (!effectiveCampaignObject) return;
      onCampaignObjectUpdated?.(
        applyMediaPlanPresentationPatch(effectiveCampaignObject, patch)
      );
    },
    [effectiveCampaignObject, onCampaignObjectUpdated]
  );

  const handlePresentationChange = useCallback(
    async (patch: { mode?: "standard" | "strategy"; view?: "internal" | "client" }) => {
      if (!campaignObjectId || !conversationId) {
        setScheduleError("Connect this workspace to save presentation settings.");
        return;
      }

      applyPresentationPatchOptimistic(patch);
      queuePresentationSave(patch);
    },
    [campaignObjectId, conversationId, applyPresentationPatchOptimistic, queuePresentationSave]
  );

  const handleSectionVisibilityChange = useCallback(
    (section: MediaPlanSectionKey, visible: boolean) => {
      if (!campaignObjectId || !conversationId) {
        setScheduleError("Connect this workspace to save section visibility.");
        return;
      }

      applyPresentationPatchOptimistic({ sections: { [section]: visible } });
      queuePresentationSave({ sections: { [section]: visible } });
    },
    [campaignObjectId, conversationId, applyPresentationPatchOptimistic, queuePresentationSave]
  );

  useEffect(() => {
    return () => {
      if (presentationSaveTimerRef.current) {
        clearTimeout(presentationSaveTimerRef.current);
      }
    };
  }, []);

  const handleMarketIntelligenceChange = useCallback(
    async (patch: Partial<MediaPlanMarketIntelligenceMeta>) => {
      if (!campaignObjectId || !conversationId) {
        setScheduleError("Connect this workspace to save market intelligence settings.");
        return;
      }

      setMarketIntelligenceSaving(true);
      setScheduleError(null);

      const result = await updateCampaignMarketIntelligenceAction({
        campaignObjectId,
        conversationId,
        marketIntelligence: patch,
      });

      setMarketIntelligenceSaving(false);

      if (!result.ok) {
        setScheduleError(result.message);
        return;
      }

      onCampaignObjectUpdated?.(result.campaignObject);
    },
    [campaignObjectId, conversationId, onCampaignObjectUpdated]
  );

  const handleInfluencerConceptsPersist = useCallback(
    async (next: CampaignObject) => {
      if (!campaignObjectId || !conversationId) {
        setScheduleError("Connect this workspace to save influencer concepts.");
        return;
      }

      setScheduleError(null);

      const result = await updateInfluencerConceptsAction({
        campaignObjectId,
        conversationId,
        influencerConcepts: next.meta.influencerConcepts ?? { concepts: [] },
      });

      if (!result.ok) {
        setScheduleError(result.message);
        return;
      }

      onCampaignObjectUpdated?.(result.campaignObject);
    },
    [campaignObjectId, conversationId, onCampaignObjectUpdated]
  );

  useEffect(() => {
    if (!panel) {
      setMediaPlanEditMode(false);
      setPreviewWindowState("normal");
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (previewWindowState === "maximized") {
        event.preventDefault();
        setPreviewWindowState("normal");
        return;
      }
      if (previewWindowState === "minimized") {
        event.preventDefault();
        setPreviewWindowState("normal");
        return;
      }
      if (mediaPlanEditMode && isMediaPlanPanel) {
        event.preventDefault();
        setMediaPlanEditMode(false);
        return;
      }
      setPanel(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel, mediaPlanEditMode, isMediaPlanPanel, previewWindowState]);

  const hasBrief = effectiveCampaignObject ? hasCampaignBriefText(effectiveCampaignObject) : false;

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const layoutSnapshotRef = useRef({ staleCount: 0, generatingKind: null as CampaignOutputKind | null });
  const [activeGroup, setActiveGroup] = useState<CampaignOutputGroup | null>(
    grouped[0]?.group ?? null
  );

  const navSections = useMemo(
    () =>
      grouped.map((section, sectionIndex) => ({
        group: section.group,
        label: section.label,
        count:
          section.outputs.length +
          (sectionIndex === 0 && effectiveCampaignObject ? 1 : 0),
      })),
    [grouped, effectiveCampaignObject]
  );

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || grouped.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topmost = visible[0];
        if (topmost) {
          const group = topmost.target.getAttribute("data-output-group") as CampaignOutputGroup;
          if (group) setActiveGroup(group);
        }
      },
      {
        root,
        rootMargin: `-${OUTPUTS_SECTION_NAV_HEIGHT + 1}px 0px -70% 0px`,
        threshold: 0,
      }
    );

    for (const section of grouped) {
      const el = sectionRefs.current.get(section.group);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [grouped]);

  const jumpToSection = useCallback(
    (group: CampaignOutputGroup) => {
      const root = scrollRef.current;
      const el = sectionRefs.current.get(group);
      if (!root || !el) return;
      const sectionIndex = grouped.findIndex((section) => section.group === group);
      const stickyTop =
        OUTPUTS_SECTION_NAV_HEIGHT +
        (sectionIndex >= 0 ? sectionIndex * OUTPUTS_GROUP_LABEL_STEP : 0);
      const y = el.offsetTop - stickyTop;
      root.scrollTo({ top: Math.max(y, 0), behavior: "smooth" });
      setActiveGroup(group);
    },
    [grouped]
  );

  // Preserve scroll when banners toggle or a card finishes generating (prevents page jump).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const prev = layoutSnapshotRef.current;
    const staleBannerRemoved = prev.staleCount > 0 && counts.stale === 0;
    const generationFinished = prev.generatingKind != null && generatingKind == null;

    if (staleBannerRemoved || generationFinished) {
      const scrollTop = root.scrollTop;
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
      });
    }

    layoutSnapshotRef.current = { staleCount: counts.stale, generatingKind: generatingKind ?? null };
  }, [counts.stale, generatingKind]);

  return (
    <div className={cn("relative flex h-full min-h-0 flex-col", OUTPUTS_CLASSES.canvas, className)}>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]"
      >
        <OutputsSectionNav
          sections={navSections}
          activeGroup={activeGroup}
          onJump={jumpToSection}
        />

        <div className={OUTPUTS_CLASSES.content}>
          {planReadinessBanner}

          {upNextCards}

          {counts.stale > 0 ? (
            <div className="oc-stale-banner">
              <AlertCircleIcon aria-hidden />
              <p>
                <strong>
                  {counts.stale} output{counts.stale === 1 ? "" : "s"} need updating
                </strong>{" "}
                {staleCause}. Regenerate affected outputs when ready.
              </p>
              {counts.regeneratableStale > 0 && onRegenerateAllStale ? (
                <button
                  type="button"
                  onClick={onRegenerateAllStale}
                  disabled={regeneratingAll || regenerateAllDisabled}
                  className="oc-btn-regen"
                >
                  {regeneratingAll ? (
                    <Loader2Icon className="animate-spin" aria-hidden />
                  ) : (
                    <RefreshCwIcon aria-hidden />
                  )}
                  {regeneratingAll ? "Regenerating all…" : "Regenerate all"}
                </button>
              ) : null}
            </div>
          ) : null}

          {regenerateAllError ? (
            <div className="oc-alert-banner mb-4">
              <AlertCircleIcon aria-hidden />
              <p>{regenerateAllError}</p>
            </div>
          ) : null}

          <div className={OUTPUTS_CLASSES.centerHead}>
            <div className="oc-center-head-left">
              <div className="oc-center-ico">
                <LayoutGridIcon aria-hidden />
              </div>
              <div>
                <h2>Campaign Outputs Center</h2>
                <div className="oc-stat-row">
                  <span className="oc-stat-chip">
                    <span className="oc-stat-dot" style={{ background: "#10B981" }} />
                    {counts.generated} generated
                  </span>
                  <span className="oc-stat-chip">
                    <span className="oc-stat-dot" style={{ background: "#F59E0B" }} />
                    {counts.stale} need update
                  </span>
                  <span className="oc-stat-chip">
                    <span className="oc-stat-dot" style={{ background: "#6B7280" }} />
                    {counts.total} available
                  </span>
                </div>
              </div>
            </div>
            {hasBrief ? (
              <button type="button" onClick={() => setBriefViewerOpen(true)} className="oc-btn">
                <FileTextIcon aria-hidden />
                View Campaign Brief
              </button>
            ) : null}
          </div>

          {effectiveCampaignObject ? (
            <div className={OUTPUTS_CLASSES.settingsStack}>
              <MediaPlanPresentationToggle
                campaignObject={effectiveCampaignObject}
                saving={presentationSaving}
                disabled={!campaignObjectId || !conversationId}
                onChange={handlePresentationChange}
                variant="setting-row"
              />
              <OutputsCenterMarketIntelligenceToggle
                campaignObject={effectiveCampaignObject}
                saving={marketIntelligenceSaving}
                disabled={!campaignObjectId || !conversationId}
                onChange={handleMarketIntelligenceChange}
                variant="setting-row"
              />
            </div>
          ) : null}

          <div>
            {grouped.map((section, sectionIndex) => (
              <section
                key={section.group}
                ref={(node) => {
                  if (node) sectionRefs.current.set(section.group, node);
                  else sectionRefs.current.delete(section.group);
                }}
                data-output-group={section.group}
              >
                <OutputsGroupLabel
                  group={section.group}
                  label={section.label}
                  sectionIndex={sectionIndex}
                  icon={GROUP_ICONS[section.group]}
                  count={
                    section.outputs.length +
                    (sectionIndex === 0 && effectiveCampaignObject ? 1 : 0)
                  }
                  onJump={() => jumpToSection(section.group)}
                />
                <div className={OUTPUTS_CLASSES.cardGrid}>
                  {sectionIndex === 0 && effectiveCampaignObject ? (
                    <CampaignBriefCard
                      campaignObject={effectiveCampaignObject}
                      conversationId={conversationId}
                      messageId={messageId}
                      onBriefApplied={onBriefApplied}
                    />
                  ) : null}
                  {section.outputs.map((output) => (
                    <OutputCard
                      key={output.kind}
                      output={output}
                      actions={mergedActions}
                      isGenerating={
                        regeneratingAll
                          ? output.status === "needs_update" && output.generatable
                          : generatingKind === output.kind
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {panel && isFloatingPreview ? (
        <DocumentPreviewWindow
          open
          windowState={previewWindowState}
          onWindowStateChange={setPreviewWindowState}
          onClose={() => setPanel(null)}
          title={panelContent?.title ?? "Document preview"}
          subtitle={
            isMediaPlanPanel && mediaPlanPreviewContext?.brandName
              ? `Brand · ${mediaPlanPreviewContext.brandName}`
              : undefined
          }
          isMediaPlan={isMediaPlanPanel}
          wide={isMediaPlanPanel}
          draggable={isPreviewInteractive}
          resizable={isPreviewInteractive}
          windowBounds={bounds}
          dragHandleProps={dragHandleProps}
          createResizeHandleProps={createResizeHandleProps}
          panelRef={panelRef}
          isDragging={isDragging}
          isResizing={isResizing}
          hitTopClamp={hitTopClamp}
          onHeaderDoubleClick={() =>
            setPreviewWindowState((state) =>
              state === "maximized" ? "normal" : "maximized"
            )
          }
          onBackdropClick={() => {
            if (isMediaPlanPanel && mediaPlanEditMode) {
              setMediaPlanEditMode(false);
              return;
            }
            setPanel(null);
          }}
          header={
            isMediaPlanPanel ? (
              <MediaPlanPreviewPanelHeader
                title={panelContent?.title}
                context={mediaPlanPreviewContext}
                draggable={isPreviewInteractive}
              />
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <GripVerticalIcon
                  className="size-4 shrink-0 text-muted-foreground/70"
                  aria-hidden
                />
                <span className="truncate text-sm font-semibold text-foreground">
                  {panelContent?.title ?? "Document preview"}
                </span>
              </div>
            )
          }
          actions={
            <>
              {isMediaPlanPanel && campaignObjectId && conversationId ? (
                <>
                  {mediaPlanEditMode ? (
                    <button
                      type="button"
                      onClick={() => setMediaPlanEditMode(false)}
                      className="rounded-md bg-[#1D9E75] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#178a66]"
                    >
                      Done editing
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setMediaPlanEditMode((value) => !value)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      mediaPlanEditMode
                        ? "border-[#0057FF]/30 bg-[#0057FF]/10 text-[#0057FF]"
                        : "border-border text-foreground/80 hover:bg-muted"
                    )}
                  >
                    {mediaPlanEditMode ? "Document view" : "Edit schedule"}
                  </button>
                </>
              ) : null}
              {isMediaPlanPanel && campaignObjectId ? (
                <MediaPlanExportDialog
                  campaignObjectId={campaignObjectId}
                  conversationId={conversationId}
                  disabled={!panelContent || scheduleSaving || presentationSaving}
                />
              ) : null}
            </>
          }
        >
          {panelContent ? (
            isMediaPlanPanel ? (
              <div
                className={
                  mediaPlanEditMode
                    ? "p-5"
                    : "flex min-h-0 flex-1 flex-col overflow-x-hidden bg-[#e5e7eb]"
                }
              >
                {scheduleError ? (
                  <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                    {scheduleError}
                  </p>
                ) : null}
                {mediaPlanEditMode ? (
                  <OutputViewer
                    content={panelContent}
                    mediaPlanContextOverride={liveMediaPlanContext}
                    editableMediaPlan={Boolean(campaignObjectId && conversationId)}
                    savingMediaPlanSchedule={scheduleSaving || marketIntelligenceSaving}
                    onMoveMediaPlanCreator={handleMoveMediaPlanCreator}
                    onMarketIntelligenceChange={handleMarketIntelligenceChange}
                    onInfluencerConceptsPersist={handleInfluencerConceptsPersist}
                    campaignObject={effectiveCampaignObject}
                    onExitEditMode={() => setMediaPlanEditMode(false)}
                  />
                ) : (
                  <>
                    {showMediaPlanSectionControls && effectiveCampaignObject ? (
                      <MediaPlanSectionVisibilityPanel
                        campaignObject={effectiveCampaignObject}
                        saving={presentationSaving}
                        disabled={!campaignObjectId || !conversationId}
                        onSectionChange={handleSectionVisibilityChange}
                      />
                    ) : null}
                    <OutputDocumentPreview
                      content={panelContent}
                      mediaPlanContextOverride={liveMediaPlanContext}
                      campaignObject={effectiveCampaignObject}
                      onInfluencerConceptsPersist={handleInfluencerConceptsPersist}
                      showSectionToggles={showMediaPlanSectionControls}
                      onSectionVisibilityChange={handleSectionVisibilityChange}
                    />
                  </>
                )}
              </div>
            ) : panel.mode === "preview" ? (
              <OutputDocumentPreview
                content={panelContent}
                mediaPlanContextOverride={liveMediaPlanContext}
                campaignObject={effectiveCampaignObject}
                onInfluencerConceptsPersist={handleInfluencerConceptsPersist}
              />
            ) : (
              <div className="p-5">
                <OutputViewer
                  content={panelContent}
                  mediaPlanContextOverride={liveMediaPlanContext}
                />
              </div>
            )
          ) : (
            <p className="p-8 text-sm text-muted-foreground">
              This output hasn&apos;t been generated yet. Generate it to preview.
            </p>
          )}
        </DocumentPreviewWindow>
      ) : panel ? (
        <div
          className="absolute inset-0 z-30 flex justify-end bg-black/30"
          onClick={() => setPanel(null)}
        >
            <div
              className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Open
                </span>
                <button
                  type="button"
                  aria-label="Close panel"
                  onClick={() => setPanel(null)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {panelContent ? (
                  <OutputViewer content={panelContent} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This output hasn&apos;t been generated yet. Generate it to preview.
                  </p>
                )}
              </div>
            </div>
        </div>
      ) : null}

      <CampaignBriefViewer
        open={briefViewerOpen}
        onOpenChange={setBriefViewerOpen}
        campaignObject={effectiveCampaignObject}
      />
    </div>
  );
}
