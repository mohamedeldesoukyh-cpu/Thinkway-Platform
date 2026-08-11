"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRangeIcon, Loader2Icon } from "lucide-react";

import { PageBackButton } from "@/components/navigation/page-back-button";
import { Button } from "@/components/ui/button";
import { MediaPlanCalendar } from "@/features/campaign-outputs/components/media-plan-calendar";
import type { MediaPlanCreatorMoveTarget } from "@/features/campaign-outputs/components/media-plan-calendar";
import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher-lazy";
import { updateMediaPlanScheduleAction } from "@/features/campaign-outputs/actions/update-media-plan-schedule";
import { seedFromCampaign } from "@/features/campaign-outputs/hydration/seed-adapters";
import { getCreatorDocumentationCompletenessAction } from "@/features/campaigns/actions/deliverable-documentation-actions";
import { restoreMediaPlanEditAction } from "@/features/campaign-outputs/actions/restore-media-plan-edit";
import { MediaPlanApprovalToolbar } from "@/features/campaigns/components/media-plan/media-plan-approval-toolbar";
import { MediaPlanComparisonPanel } from "@/features/campaigns/components/media-plan/media-plan-comparison-panel";
import { MediaPlanHistoryPanel } from "@/features/campaigns/components/media-plan/media-plan-history-panel";
import type { CampaignMediaPlanWorkspacePayload } from "@/features/campaigns/queries/load-campaign-media-plan";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { mediaPlanStatusLabel, type MediaPlanViewKind } from "@/lib/media-plan";
import type { DocumentationCompleteness } from "@/lib/services/deliverables/documentation-types";
import { campaignDetailPath } from "@/lib/routing/entity-paths";
import { cn } from "@/lib/utils";

const VIEW_TABS: Array<{ id: MediaPlanViewKind; label: string }> = [
  { id: "original", label: "Original" },
  { id: "actual", label: "Actual" },
  { id: "remaining", label: "Remaining" },
];

type CampaignMediaPlanWorkspaceProps = {
  workspace: CampaignWorkspace;
  payload: CampaignMediaPlanWorkspacePayload;
  initialView?: MediaPlanViewKind;
};

function isViewKind(value: string | null | undefined): value is MediaPlanViewKind {
  return value === "original" || value === "actual" || value === "remaining";
}

export function CampaignMediaPlanWorkspace({
  workspace,
  payload,
  initialView = "original",
}: CampaignMediaPlanWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<MediaPlanViewKind>(initialView);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [saving, setSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [docsStatusByCreator, setDocsStatusByCreator] = useState<
    Record<string, DocumentationCompleteness>
  >({});

  useEffect(() => {
    void getCreatorDocumentationCompletenessAction({
      campaignHeaderId: workspace.id,
    }).then((result) => {
      if (result.ok) setDocsStatusByCreator(result.data);
    });
  }, [workspace.id]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [redoStack, setRedoStack] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollByView = useRef<Partial<Record<MediaPlanViewKind, number>>>({});
  const editable =
    (view === "original" && payload.canEditOriginal) ||
    (view === "remaining" && payload.canEditRemaining);
  const scheduleEditHint =
    view === "remaining" && payload.canEditRemaining
      ? "Drag unpublished creator cards to reschedule. Live / partial cards stay fixed."
      : null;

  const latestEditNumber = useMemo(() => {
    const nums = payload.editHistory.map((e) => e.editNumber);
    return nums.length ? Math.max(...nums) : 0;
  }, [payload.editHistory]);

  const canUndo = editable && latestEditNumber > 1;
  const canRedo = editable && redoStack.length > 0;

  const restoreEdit = useCallback(
    async (editNumber: number, mode: "undo" | "redo") => {
      if (!payload.campaignObjectId || !payload.conversationId) return;
      setScheduleError(null);
      setSaving(true);
      const tipBefore = latestEditNumber;
      const result = await restoreMediaPlanEditAction({
        campaignObjectId: payload.campaignObjectId,
        conversationId: payload.conversationId,
        campaignId: workspace.id,
        editNumber,
      });
      setSaving(false);
      if (!result.ok) {
        setScheduleError(result.message);
        return;
      }
      if (mode === "undo" && tipBefore > 0) {
        setRedoStack((stack) => [...stack, tipBefore]);
      }
      if (mode === "redo") {
        setRedoStack((stack) => stack.slice(0, -1));
      }
      startTransition(() => router.refresh());
    },
    [
      latestEditNumber,
      payload.campaignObjectId,
      payload.conversationId,
      router,
      workspace.id,
    ]
  );

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    void restoreEdit(latestEditNumber - 1, "undo");
  }, [canUndo, latestEditNumber, restoreEdit]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const target = redoStack[redoStack.length - 1];
    if (target == null) return;
    void restoreEdit(target, "redo");
  }, [canRedo, redoStack, restoreEdit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!editable) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, handleRedo, handleUndo]);

  useEffect(() => {
    const fromQuery = searchParams.get("view");
    if (isViewKind(fromQuery) && fromQuery !== view) {
      setView(fromQuery);
    }
  }, [searchParams, view]);

  const handleViewChange = useCallback(
    (next: MediaPlanViewKind) => {
      if (scrollRef.current) {
        scrollByView.current[view] = scrollRef.current.scrollTop;
      }
      setView(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "original") params.delete("view");
      else params.set("view", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, view]
  );

  const handlePlanChange = useCallback(
    (planId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const defaultId = payload.mediaPlans.find((plan) => plan.isDefault)?.campaignObjectId;
      if (!planId || planId === defaultId) params.delete("planId");
      else params.set("planId", planId);
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        router.refresh();
      });
    },
    [pathname, payload.mediaPlans, router, searchParams]
  );

  useEffect(() => {
    const saved = scrollByView.current[view];
    if (scrollRef.current != null && saved != null) {
      scrollRef.current.scrollTop = saved;
    }
  }, [view]);

  const data = payload.views[view];

  const studioSeed = useMemo(
    () =>
      seedFromCampaign({
        name: workspace.name,
        brief: workspace.brief,
        platform: workspace.platform,
        currency_code: workspace.currency_code,
        client: workspace.client,
        brand: workspace.brand,
        group: workspace.group,
        financials: { budget: workspace.financials.budget },
      }),
    [workspace]
  );

  const handleMoveCreator = useCallback(
    async (target: MediaPlanCreatorMoveTarget) => {
      if (!payload.campaignObjectId || !payload.conversationId) {
        setScheduleError("Connect this campaign to Studio to save schedule changes.");
        return;
      }
      setSaving(true);
      setScheduleError(null);
      const result = await updateMediaPlanScheduleAction({
        campaignObjectId: payload.campaignObjectId,
        conversationId: payload.conversationId,
        campaignId: workspace.id,
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
      setSaving(false);
      if (!result.ok) {
        setScheduleError(result.message);
        return;
      }
      setRedoStack([]);
      startTransition(() => router.refresh());
    },
    [payload.campaignObjectId, payload.conversationId, router, workspace.id]
  );

  const backHref = campaignDetailPath({
    id: workspace.id,
    document_number: workspace.document_number,
    name: workspace.name,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <PageBackButton
            fallbackHref={backHref}
            label="Back to campaign"
            className="size-8 rounded-lg p-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarRangeIcon className="size-4 text-[var(--tw-primary,#1D9E75)]" />
              <h1 className="truncate text-base font-semibold tracking-tight">Media Plan</h1>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {payload.versionLabel}
              </span>
              <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium">
                {mediaPlanStatusLabel(payload.status)}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{workspace.name}</p>
            {payload.mediaPlans.length > 1 ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <label
                  htmlFor="campaign-media-plan-select"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Plan
                </label>
                <select
                  id="campaign-media-plan-select"
                  className="h-7 max-w-xs rounded-md border border-border bg-background px-2 text-xs"
                  value={payload.campaignObjectId ?? ""}
                  onChange={(event) => handlePlanChange(event.target.value)}
                  disabled={pending}
                >
                  {payload.mediaPlans.map((plan) => (
                    <option key={plan.campaignObjectId} value={plan.campaignObjectId}>
                      {plan.label}
                      {plan.isDefault ? " (default)" : ""}
                      {` · ${mediaPlanStatusLabel(plan.status)}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={orientation === "landscape" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setOrientation("landscape")}
            >
              Landscape
            </Button>
            <Button
              type="button"
              size="sm"
              variant={orientation === "portrait" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setOrientation("portrait")}
            >
              Portrait
            </Button>
            <OpenCampaignStudioLauncher
              seed={studioSeed}
              workspace={{ type: "campaign", id: workspace.id }}
              existingConversationId={payload.conversationId ?? undefined}
              tab="outputs"
              label="Open in Studio"
              variant="outline"
            />
            {payload.campaignObjectId && payload.conversationId ? (
              <MediaPlanApprovalToolbar
                campaignId={workspace.id}
                campaignObjectId={payload.campaignObjectId}
                conversationId={payload.conversationId}
                status={payload.status}
                hasApprovedBaseline={payload.hasApprovedBaseline}
                hasWorkingDraft={payload.hasWorkingDraft}
                onCompare={() => setCompareOpen(true)}
                onHistory={() => setHistoryOpen(true)}
                onUndo={editable ? handleUndo : undefined}
                onRedo={editable ? handleRedo : undefined}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            ) : null}
          </div>
        </div>

        <div
          className="mt-3 flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label="Media Plan views"
        >
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => handleViewChange(tab.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                view === tab.id
                  ? "bg-[var(--tw-primary,#1D9E75)] text-white"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
          {pending ? <Loader2Icon className="ml-2 size-3.5 animate-spin text-muted-foreground" /> : null}
        </div>

        {view !== "original" && !payload.hasApprovedBaseline ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Actual and Remaining are generated from the Current Approved Baseline. Approve the
            Original Media Plan to enable these views.
          </p>
        ) : null}
        {scheduleEditHint ? (
          <p className="mt-2 text-xs text-muted-foreground">{scheduleEditHint}</p>
        ) : null}
        {view === "remaining" && payload.hasApprovedBaseline && !payload.canEditRemaining ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Unlock or open a working draft to reschedule unpublished Remaining cards.
          </p>
        ) : null}
        {view === "remaining" && payload.unscheduledRemainingCount > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {payload.unscheduledRemainingCount} remaining deliverable
            {payload.unscheduledRemainingCount === 1 ? "" : "s"} without a planned date.
          </p>
        ) : null}
        {scheduleError ? (
          <p className="mt-2 text-xs text-destructive">{scheduleError}</p>
        ) : null}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-4 py-4 md:px-6">
        <MediaPlanComparisonPanel
          open={compareOpen}
          onOpenChange={setCompareOpen}
          diffs={payload.comparisonDiffs}
          baselineVersion={payload.baselineVersion}
          draftVersion={payload.draftVersion}
        />
        {payload.campaignObjectId && payload.conversationId ? (
          <MediaPlanHistoryPanel
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            campaignId={workspace.id}
            campaignObjectId={payload.campaignObjectId}
            conversationId={payload.conversationId}
            editHistory={payload.editHistory}
            businessVersions={payload.businessVersions}
            currentVersionLabel={payload.tipVersionLabel ?? payload.versionLabel}
          />
        ) : null}
        {payload.emptyReason ? (
          <div className="mx-auto flex max-w-lg flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6">
            <p className="text-sm text-muted-foreground">{payload.emptyReason}</p>
            <OpenCampaignStudioLauncher
              seed={studioSeed}
              workspace={{ type: "campaign", id: workspace.id }}
              existingConversationId={payload.conversationId ?? undefined}
              tab="outputs"
              label="Open Studio Media Plan"
              variant="primary"
            />
            <Link href={backHref} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              Return to campaign
            </Link>
          </div>
        ) : (
          <MediaPlanCalendar
            data={data}
            orientation={orientation}
            editable={editable}
            saving={saving}
            onMoveCreator={editable ? handleMoveCreator : undefined}
            documentationStatusByCreatorId={docsStatusByCreator}
            onDocumentationClick={(creatorId) => {
              router.push(
                `${campaignDetailPath(workspace.id)}?tab=deliverables&docsCreator=${encodeURIComponent(creatorId)}`
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
