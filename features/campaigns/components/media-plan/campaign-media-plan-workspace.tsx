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
import { MediaPlanApprovalToolbar } from "@/features/campaigns/components/media-plan/media-plan-approval-toolbar";
import { MediaPlanComparisonPanel } from "@/features/campaigns/components/media-plan/media-plan-comparison-panel";
import type { CampaignMediaPlanWorkspacePayload } from "@/features/campaigns/queries/load-campaign-media-plan";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { mediaPlanStatusLabel, type MediaPlanViewKind } from "@/lib/media-plan";
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
  const [compareOpen, setCompareOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollByView = useRef<Partial<Record<MediaPlanViewKind, number>>>({});

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

  useEffect(() => {
    const saved = scrollByView.current[view];
    if (scrollRef.current != null && saved != null) {
      scrollRef.current.scrollTop = saved;
    }
  }, [view]);

  const data = payload.views[view];
  const editable = view === "original" && payload.canEditOriginal;

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
          />
        )}
      </div>
    </div>
  );
}
