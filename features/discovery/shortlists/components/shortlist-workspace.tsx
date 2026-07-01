"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  FileTextIcon,
  GitCompareArrowsIcon,
  SendIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { glassFlyoutContentClass } from "@/components/shared/navigation/glass-selection-flyout";
import { cn } from "@/lib/utils";
import { stashCompareQueue } from "@/features/discovery/components/creator-search/creator-search-utils";
import { refreshCreatorsBatchAction } from "@/features/discovery/enrichment/actions";
import { pollCreatorsAfterBatchRefresh } from "@/features/discovery/enrichment/poll-creator-refresh";
import {
  isEnrichmentInProgress,
  resolveCreatorEnrichmentStatus,
  syncStatusToEnrichmentStatus,
  type CreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import type { ShortlistTemplateVariant } from "@/features/discovery/shortlists/export/shortlist-template";
import { buildShortlistExportHref } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import {
  addShortlistCreatorsToQuotation,
  createQuotationFromShortlist,
} from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import { generateQuotationVersion } from "@/features/quotations/lifecycle-actions";
import { canGenerateQuotationVersion } from "@/lib/commercial-sync/rules";
import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorMovementAction } from "@/types/database";

import {
  bulkApproveCreators,
  bulkCancelCreators,
  bulkRejectCreators,
  bulkRemoveCreatorsFromShortlist,
  bulkSubmitCreatorsForReview,
  submitEntireShortlistForReview,
} from "../bulk-actions";
import {
  countSelected,
  filterEligibleForMove,
  filterSelectedItems,
  isAllVisibleSelected,
  isIndeterminateSelection,
  pruneSelection,
  toggleItemSelection,
  toggleSelectAll,
} from "../bulk-selection-policy";
import {
  approveShortlist,
  archiveShortlist,
  cancelShortlist,
  rejectShortlist,
  reopenShortlist,
  removeCreatorFromShortlistV2,
} from "../actions";
import { canEditCreators, canMoveToCampaign } from "../transitions";
import type {
  ShortlistBrandOption,
  ShortlistCampaignOption,
  ShortlistDetail,
} from "../types";
import { AddCreatorsDrawer } from "./add-creators-drawer";
import { GenerateQuotationShortlistDialog } from "./generate-quotation-shortlist-dialog";
import { MoveToCampaignDialog } from "./move-to-campaign-dialog";
import {
  ShortlistQuotationActions,
  ShortlistQuotationPanel,
} from "./shortlist-quotation-panel";
import { ShortlistBulkToolbar } from "./shortlist-bulk-toolbar";
import { ShortlistCreatorToolbarActions } from "./shortlist-creator-toolbar-actions";
import {
  ShortlistCreatorEmptyState,
  ShortlistCreatorList,
} from "./shortlist-creator-list";
import { ShortlistMetricsRefreshBanner } from "./shortlist-metrics-refresh-banner";
import { SubmitShortlistDialog } from "./submit-shortlist-dialog";
import {
  AssignmentStatusBadge,
} from "./shortlist-badges";
import {
  ShortlistDetailCard,
  ShortlistHeaderPill,
  ShortlistToolbarButton,
} from "./shortlist-detail-primitives";
import {
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";

const MOVEMENT_LABELS: Record<CreatorMovementAction, string> = {
  discovery_to_shortlist: "Added from discovery",
  shortlist_to_campaign: "Moved to campaign",
  campaign_to_shortlist: "Returned from campaign",
  campaign_to_removed: "Removed from campaign",
  creator_added: "Creator added",
  creator_removed: "Creator removed",
  shortlist_submitted: "Submitted for review",
  shortlist_approved: "Approved",
  shortlist_rejected: "Returned to draft",
  shortlist_cancelled: "Cancelled",
  shortlist_reopened: "Reopened",
  shortlist_archived: "Archived",
};

export function ShortlistWorkspace({
  detail,
  campaigns,
  brands,
}: {
  detail: ShortlistDetail;
  campaigns: ShortlistCampaignOption[];
  brands: ShortlistBrandOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [submitAllOpen, setSubmitAllOpen] = useState(false);
  const [quoteAllOpen, setQuoteAllOpen] = useState(false);
  const [exportTemplate, setExportTemplate] = useState<ShortlistTemplateVariant>("summary");
  const [enrichmentOverrides, setEnrichmentOverrides] = useState<
    Map<string, CreatorEnrichmentStatus>
  >(() => new Map());
  const [creatorPatches, setCreatorPatches] = useState<
    Map<string, UnifiedCreatorResult>
  >(() => new Map());
  const [refreshProgress, setRefreshProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
  } | null>(null);

  const refreshingMetrics = refreshProgress != null && refreshProgress.completed < refreshProgress.total;

  const editable = canEditCreators(detail.status) && !detail.is_archived;
  const movable = canMoveToCampaign(detail.status);
  const selectable = !detail.is_archived && detail.creators.length > 0;
  const linkedQuotations = detail.linkedQuotations;
  const hasLinkedQuotation = linkedQuotations.length > 0;
  const latestQuotation = linkedQuotations[0] ?? null;

  const visibleItemIds = useMemo(
    () => detail.creators.map((item) => item.item_id),
    [detail.creators]
  );

  const effectiveSelectedIds = useMemo(
    () => pruneSelection(selectedIds, visibleItemIds),
    [selectedIds, visibleItemIds]
  );

  const selectedCount = countSelected(effectiveSelectedIds);
  const allSelected = isAllVisibleSelected(visibleItemIds, effectiveSelectedIds);
  const indeterminate = isIndeterminateSelection(visibleItemIds, effectiveSelectedIds);

  const selectedItems = useMemo(
    () => filterSelectedItems(detail.creators, effectiveSelectedIds),
    [detail.creators, effectiveSelectedIds]
  );

  const selectedItemIdList = useMemo(
    () => selectedItems.map((item) => item.item_id),
    [selectedItems]
  );

  const existingItems = useMemo(
    () =>
      detail.creators.map((item) => ({
        unified_id: item.unified_id,
        profile_id: item.profile_id,
        influencer_id: item.influencer_id,
      })),
    [detail.creators]
  );

  const patchCreatorInList = useCallback((next: UnifiedCreatorResult) => {
    setCreatorPatches((prev) => {
      const map = new Map(prev);
      map.set(next.unified_id, next);
      return map;
    });
  }, []);

  useEffect(() => {
    setCreatorPatches((prev) => (prev.size === 0 ? prev : new Map()));

    setEnrichmentOverrides((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const item of detail.creators) {
        const unifiedId = item.unified_id ?? item.creator?.unified_id ?? null;
        if (!unifiedId || !next.has(unifiedId)) continue;
        const override = next.get(unifiedId)!;
        const serverStatus = resolveCreatorEnrichmentStatus(item.creator?.enrichment_status);
        if (
          !isEnrichmentInProgress(override) &&
          !isEnrichmentInProgress(serverStatus)
        ) {
          next.delete(unifiedId);
        }
      }
      return next;
    });
  }, [detail.creators]);

  const displayCreators = useMemo(
    () =>
      detail.creators.map((item) => {
        if (!item.creator) return item;
        const unifiedId = item.unified_id ?? item.creator.unified_id ?? null;
        if (!unifiedId) return item;
        const patch = creatorPatches.get(unifiedId);
        const override = enrichmentOverrides.get(unifiedId);
        let creator = patch ?? item.creator;
        if (override) {
          creator = { ...creator, enrichment_status: override };
        }
        if (creator === item.creator && !override) return item;
        return { ...item, creator };
      }),
    [detail.creators, creatorPatches, enrichmentOverrides]
  );

  function selectedCreators(): UnifiedCreatorResult[] {
    return selectedItems
      .filter((item) => item.creator)
      .map((item) => item.creator as UnifiedCreatorResult);
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleCompare() {
    const pool =
      selectedCount > 0
        ? selectedCreators()
        : detail.creators.filter((i) => i.creator).map((i) => i.creator!);
    if (pool.length < 2) {
      toast.error("Select at least 2 creators with resolved profiles to compare.");
      return;
    }
    stashCompareQueue(pool.slice(0, MAX_CREATOR_COMPARE));
    router.push("/discovery/compare");
  }

  function handleExportSelected() {
    const itemIds = selectedCount > 0 ? selectedItemIdList : undefined;
    const href = buildShortlistExportHref(detail.id, "csv", exportTemplate, { itemIds });
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function handleRefreshMetrics() {
    const pool =
      selectedCount > 0
        ? selectedItems.filter((item) => {
            const unifiedId = item.unified_id ?? item.creator?.unified_id;
            return unifiedId && item.influencer_id;
          })
        : detail.creators.filter((item) => {
            const unifiedId = item.unified_id ?? item.creator?.unified_id;
            return unifiedId && item.influencer_id;
          });

    if (pool.length === 0) {
      toast.error("No creators with linked vendor profiles to refresh.");
      return;
    }

    const targets = pool.map((item) => ({
      unifiedId: (item.unified_id ?? item.creator!.unified_id)!,
      influencerId: item.influencer_id!,
    }));
    const unifiedIds = targets.map((target) => target.unifiedId);

    setRefreshProgress({ total: targets.length, completed: 0, failed: 0 });
    setEnrichmentOverrides((prev) => {
      const next = new Map(prev);
      for (const target of targets) {
        next.set(target.unifiedId, "queued");
      }
      return next;
    });

    let failedCount = 0;

    startTransition(async () => {
      try {
        const result = await refreshCreatorsBatchAction(unifiedIds);
        if (!result.queued) {
          setRefreshProgress(null);
          setEnrichmentOverrides(new Map());
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        void pollCreatorsAfterBatchRefresh(targets, {
          onUpdated: patchCreatorInList,
          onStatusChange: ({ unifiedId, status }) => {
            setEnrichmentOverrides((prev) => {
              const next = new Map(prev);
              next.set(unifiedId, syncStatusToEnrichmentStatus(status));
              return next;
            });
          },
          onComplete: ({ status }) => {
            if (status === "failed") failedCount += 1;
            setRefreshProgress((prev) =>
              prev
                ? {
                    ...prev,
                    completed: prev.completed + 1,
                    failed: prev.failed + (status === "failed" ? 1 : 0),
                  }
                : null
            );
          },
        }).finally(() => {
          if (failedCount > 0) {
            toast.error(
              failedCount === targets.length
                ? "Creator refresh failed"
                : `${failedCount} of ${targets.length} creator refreshes failed`
            );
          } else {
            toast.success("Creator metrics updated");
          }
          window.setTimeout(() => {
            setRefreshProgress(null);
          }, 1200);
          router.refresh();
        });
      } catch (error) {
        setRefreshProgress(null);
        setEnrichmentOverrides(new Map());
        toast.error(error instanceof Error ? error.message : "Refresh failed");
      }
    });
  }

  const runQuotation = useCallback(
    (itemIds?: string[]) => {
      startTransition(async () => {
        const res = itemIds?.length
          ? await createQuotationFromShortlist(detail.id, { itemIds })
          : await createQuotationFromShortlist(detail.id);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message ?? "Quotation created.");
        if (res.data?.id) router.push(quotationDetailPath(res.data.id));
      });
    },
    [detail.id, router]
  );

  function handleGenerateQuotation() {
    if (detail.creators.length === 0) {
      toast.error("Add creators to this shortlist first.");
      return;
    }
    if (selectedCount > 0) {
      runQuotation(selectedItemIdList);
      return;
    }
    setQuoteAllOpen(true);
  }

  function handleGenerateNewVersion() {
    if (!latestQuotation) {
      handleGenerateQuotation();
      return;
    }
    if (canGenerateQuotationVersion(latestQuotation.status)) {
      startTransition(async () => {
        const res = await generateQuotationVersion({ quotationId: latestQuotation.id });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message ?? "New version created.");
        if (res.data?.newQuotationId) {
          router.push(quotationDetailPath(res.data.newQuotationId));
        } else {
          router.refresh();
        }
      });
      return;
    }
    handleGenerateQuotation();
  }

  function handleAddToQuotation(itemId: string) {
    startTransition(async () => {
      const res = await addShortlistCreatorsToQuotation({
        shortlistId: detail.id,
        itemIds: [itemId],
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Added to quotation.");
      if (res.data?.quotationId) router.push(quotationDetailPath(res.data.quotationId));
    });
  }

  function handleSubmitForReview() {
    if (selectedCount > 0) {
      runAction(async () =>
        bulkSubmitCreatorsForReview(detail.id, selectedItemIdList)
      );
      return;
    }
    setSubmitAllOpen(true);
  }

  function handleSubmitEntireShortlist() {
    runAction(async () => {
      const result = await submitEntireShortlistForReview(detail.id);
      if (result.ok) {
        setSubmitAllOpen(false);
        clearSelection();
      }
      return result;
    });
  }

  function handleBulkRemove() {
    runAction(async () => {
      const result = await bulkRemoveCreatorsFromShortlist(detail.id, selectedItemIdList);
      if (result.ok) clearSelection();
      return result;
    });
  }

  function handleBulkMove() {
    const eligible = filterEligibleForMove(selectedItems);
    if (eligible.length === 0) {
      toast.error("Selected creators must be approved before moving to a campaign.");
      return;
    }
    setMoveOpen(true);
  }

  function handleBulkApprove() {
    runAction(() => bulkApproveCreators(detail.id, selectedItemIdList));
  }

  function handleBulkReject() {
    runAction(() => bulkRejectCreators(detail.id, selectedItemIdList));
  }

  function handleBulkCancel() {
    runAction(() => bulkCancelCreators(detail.id, selectedItemIdList));
  }

  function runAction(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message ?? "Done");
          router.refresh();
        } else {
          toast.error(result.message ?? "Action failed");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    });
  }

  function handleToggleSelectAll() {
    setSelectedIds(toggleSelectAll(visibleItemIds, effectiveSelectedIds, !allSelected));
  }

  return (
    <div className="space-y-4">
      <ShortlistDetailCard className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {detail.serial_number ?? "—"}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {detail.name}
          </h1>
          {detail.description ? (
            <p className="text-sm text-muted-foreground">{detail.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <ShortlistHeaderPill>{SHORTLIST_STATUS_LABELS[detail.status]}</ShortlistHeaderPill>
            <ShortlistHeaderPill>
              {SHORTLIST_VISIBILITY_LABELS[detail.visibility]}
            </ShortlistHeaderPill>
            <ShortlistHeaderPill>
              Owner:{" "}
              <strong className="ml-0.5 font-medium text-foreground">
                {detail.owner_name ?? "—"}
              </strong>
            </ShortlistHeaderPill>
            {detail.brand_name ? (
              <ShortlistHeaderPill>
                {detail.brand_name}
                {detail.client_name ? ` (${detail.client_name})` : ""}
              </ShortlistHeaderPill>
            ) : null}
          </div>
          {detail.status === "approved" && detail.approved_by_name ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Approved by {detail.approved_by_name}
              {detail.approved_at
                ? ` · ${format(new Date(detail.approved_at), "MMM d, yyyy")}`
                : ""}
            </p>
          ) : null}
          {detail.status === "cancelled" && detail.cancellation_reason ? (
            <p className="text-xs text-destructive">
              Cancelled: {detail.cancellation_reason}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 pt-0.5">
          {detail.status === "draft" ? (
            <ShortlistToolbarButton
              variant="primary"
              onClick={handleSubmitForReview}
              disabled={isPending || detail.creators.length === 0}
            >
              <SendIcon className="size-3.5" />
              Submit for review
            </ShortlistToolbarButton>
          ) : null}
          {detail.status === "under_review" && detail.canApprove ? (
            <>
              <ShortlistToolbarButton
                variant="primary"
                onClick={() => runAction(() => approveShortlist(detail.id))}
                disabled={isPending}
              >
                Approve
              </ShortlistToolbarButton>
              <ShortlistToolbarButton
                onClick={() => runAction(() => rejectShortlist(detail.id))}
                disabled={isPending}
              >
                Return to draft
              </ShortlistToolbarButton>
            </>
          ) : null}
          {detail.status === "approved" && selectedCount > 0 ? (
            <ShortlistToolbarButton onClick={handleBulkMove} disabled={isPending}>
              Move to campaign ({selectedCount})
            </ShortlistToolbarButton>
          ) : null}
          {detail.status === "cancelled" ? (
            <ShortlistToolbarButton
              onClick={() => runAction(() => reopenShortlist(detail.id))}
              disabled={isPending}
            >
              Reopen
            </ShortlistToolbarButton>
          ) : null}
          {detail.status !== "archived" && detail.status !== "cancelled" ? (
            <ShortlistToolbarButton
              onClick={() => runAction(() => cancelShortlist(detail.id))}
              disabled={isPending}
            >
              Cancel
            </ShortlistToolbarButton>
          ) : null}
          {detail.status !== "archived" ? (
            <ShortlistToolbarButton
              variant="danger"
              onClick={() => runAction(() => archiveShortlist(detail.id))}
              disabled={isPending}
            >
              Archive
            </ShortlistToolbarButton>
          ) : null}
        </div>

        {hasLinkedQuotation ? (
          <div className="w-full border-t border-border pt-4">
            <ShortlistQuotationPanel
              quotations={linkedQuotations}
              onGenerateNewVersion={handleGenerateNewVersion}
              busy={isPending}
            />
          </div>
        ) : null}
      </ShortlistDetailCard>

      <ShortlistDetailCard padding="none" className={cn(glassFlyoutContentClass(selectedCount > 0))}>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-bold text-foreground">
                Creators{" "}
                <span className="font-normal text-muted-foreground">
                  ({detail.creators.length})
                </span>
              </p>
              <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                Discovery-style creator rows with review status. Select creators for bulk
                actions.
              </p>
            </div>

            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            {detail.creators.length > 0 ? (
              <>
                {hasLinkedQuotation ? (
                  <ShortlistQuotationActions
                    quotations={linkedQuotations}
                    onGenerateNewVersion={handleGenerateNewVersion}
                    busy={isPending}
                  />
                ) : (
                  <ShortlistToolbarButton
                    onClick={handleGenerateQuotation}
                    disabled={isPending}
                  >
                    <FileTextIcon className="size-3.5" />
                    Generate quotation
                  </ShortlistToolbarButton>
                )}
                <ShortlistToolbarButton onClick={handleCompare} disabled={isPending}>
                  <GitCompareArrowsIcon className="size-3.5" />
                  Compare
                </ShortlistToolbarButton>
                <ShortlistCreatorToolbarActions
                  shortlistId={detail.id}
                  exportTemplate={exportTemplate}
                  onExportTemplateChange={setExportTemplate}
                  selectedItemIds={selectedItemIdList}
                  busy={isPending || refreshingMetrics}
                  onRefreshMetrics={handleRefreshMetrics}
                />
              </>
            ) : null}
            {editable ? (
              <ShortlistToolbarButton
                variant="primary"
                onClick={() => setAddOpen(true)}
                disabled={isPending}
              >
                <UserPlusIcon className="size-3.5" />
                Add creators
              </ShortlistToolbarButton>
            ) : null}
            </div>
          </div>
        </div>

        {refreshProgress ? (
          <ShortlistMetricsRefreshBanner
            total={refreshProgress.total}
            completed={refreshProgress.completed}
            failed={refreshProgress.failed}
          />
        ) : null}

        {detail.creators.length === 0 ? (
          <ShortlistCreatorEmptyState
            editable={editable}
            onAddCreators={() => setAddOpen(true)}
          />
        ) : (
          <ShortlistCreatorList
            items={displayCreators}
            selectedIds={effectiveSelectedIds}
            selectable={selectable}
            allSelected={allSelected}
            indeterminate={indeterminate}
            editable={editable}
            busy={isPending}
            onToggleSelect={(itemId) =>
              setSelectedIds(
                toggleItemSelection(
                  effectiveSelectedIds,
                  itemId,
                  !effectiveSelectedIds.has(itemId)
                )
              )
            }
            onToggleSelectAll={handleToggleSelectAll}
            onRemove={(itemId) =>
              runAction(() => removeCreatorFromShortlistV2(detail.id, itemId))
            }
            onAddToQuotation={handleAddToQuotation}
          />
        )}
      </ShortlistDetailCard>

      {detail.movedAssignments.length > 0 ? (
        <ShortlistDetailCard>
          <h2 className="text-sm font-bold text-foreground">Moved to campaigns</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Creators moved from this shortlist and their current assignment status.
          </p>
          <div className="mt-4 space-y-2">
            {detail.movedAssignments.map((assignment) => (
              <div
                key={assignment.assignment_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {assignment.influencer_name ?? "Creator"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {assignment.campaign_document_number ??
                      assignment.campaign_name ??
                      assignment.campaign_header_id}
                  </p>
                </div>
                <AssignmentStatusBadge status={assignment.assignment_status} />
              </div>
            ))}
          </div>
        </ShortlistDetailCard>
      ) : null}

      <ShortlistDetailCard>
        <h2 className="text-sm font-bold text-foreground">Movement history</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Audit trail of every creator movement.
        </p>
        {detail.movements.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No movements recorded yet.
          </p>
        ) : (
          <div className="mt-4">
            {detail.movements.map((movement, index) => (
              <div
                key={movement.id}
                className={cn(
                  "relative flex gap-3 py-2.5",
                  index < detail.movements.length - 1 && "border-b border-border"
                )}
              >
                {index < detail.movements.length - 1 ? (
                  <span
                    className="absolute left-[7px] top-[26px] bottom-[-10px] w-px bg-border"
                    aria-hidden
                  />
                ) : null}
                <span
                  className="relative z-[1] mt-0.5 size-[15px] shrink-0 rounded-full border-2 border-primary bg-primary/10 shadow-[0_0_0_3px_rgba(0,87,255,0.1)]"
                  aria-hidden
                />
                <div className="min-w-0 pb-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {MOVEMENT_LABELS[movement.action]}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {movement.performed_by_name ? (
                      <span className="font-medium text-primary">
                        {movement.performed_by_name}
                      </span>
                    ) : (
                      "System"
                    )}
                    {" · "}
                    {format(new Date(movement.performed_at), "MMM d, yyyy HH:mm")}
                    {movement.notes ? ` · ${movement.notes}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ShortlistDetailCard>

      <MoveToCampaignDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        shortlistId={detail.id}
        shortlistName={detail.name}
        selectedItemIds={
          selectedItemIdList.length > 0
            ? filterEligibleForMove(selectedItems).map((item) => item.item_id)
            : []
        }
        campaigns={campaigns}
        brands={brands}
      />

      <SubmitShortlistDialog
        open={submitAllOpen}
        onOpenChange={setSubmitAllOpen}
        creatorCount={detail.creators.length}
        onConfirm={handleSubmitEntireShortlist}
        busy={isPending}
      />

      <GenerateQuotationShortlistDialog
        open={quoteAllOpen}
        onOpenChange={setQuoteAllOpen}
        creatorCount={detail.creators.length}
        shortlistName={detail.name}
        onConfirm={() => {
          setQuoteAllOpen(false);
          runQuotation();
        }}
        busy={isPending}
      />

      <AddCreatorsDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        shortlistId={detail.id}
        existingItems={existingItems}
        onAdded={() => router.refresh()}
      />

      <ShortlistBulkToolbar
        selectedCount={selectedCount}
        showSubmit={editable}
        showStatusActions={detail.status === "under_review" && detail.canApprove}
        showMove={movable}
        busy={isPending || refreshingMetrics}
        onSubmitSelected={() =>
          runAction(() => bulkSubmitCreatorsForReview(detail.id, selectedItemIdList))
        }
        onRemoveSelected={handleBulkRemove}
        onCompareSelected={handleCompare}
        onRefreshMetrics={handleRefreshMetrics}
        onExportSelected={handleExportSelected}
        onMoveSelected={handleBulkMove}
        onGenerateQuotation={handleGenerateQuotation}
        onApproveSelected={handleBulkApprove}
        onRejectSelected={handleBulkReject}
        onCancelSelected={handleBulkCancel}
        onClearSelection={clearSelection}
      />
    </div>
  );
}
