"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArchiveIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SendIcon,
  UserPlusIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GenerateOutputsLauncher } from "@/features/campaign-outputs/components/generate-outputs-launcher-lazy";
import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher";
import type { CampaignSeed } from "@/features/campaign-outputs/hydration/hydration-types";

import { discoverySelectionFlyoutContentClass } from "@/features/discovery/components/design-system/discovery-selection-flyout";
import { cn } from "@/lib/utils";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import { useCreatorDetailSheetState } from "@/features/discovery/hooks/use-creator-detail-sheet-state";
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
  collapseShortlistCreators,
  uncollapseShortlistCreators,
  submitEntireShortlistForReview,
} from "../bulk-actions";
import {
  selectedItemsCanCollapse,
  selectedItemsCanUncollapse,
} from "../shortlist-collapse-groups";
import {
  countSelected,
  filterEligibleForMove,
  filterSelectedItems,
  isAllVisibleSelected,
  isIndeterminateSelection,
  pruneSelection,
  toggleGroupSelection,
  toggleItemSelection,
  toggleSelectAll,
} from "../bulk-selection-policy";
import {
  approveShortlist,
  archiveShortlist,
  cancelShortlist,
  rejectShortlist,
  reopenShortlist,
} from "../actions";
import { canEditCreators, canMoveToCampaign, isMovementLocked } from "../transitions";
import type {
  ShortlistBrandOption,
  ShortlistCampaignOption,
  ShortlistClientOption,
  ShortlistDetail,
} from "../types";
import { AddCreatorsDrawer } from "./add-creators-drawer";
import { GenerateQuotationShortlistDialog } from "./generate-quotation-shortlist-dialog";
import { MoveToCampaignDialog } from "./move-to-campaign-dialog";
import { ShortlistEditDialog } from "./shortlist-edit-dialog";
import {
  ShortlistQuotationPanel,
} from "./shortlist-quotation-panel";
import { ShortlistBulkToolbar } from "./shortlist-bulk-toolbar";
import { ShortlistCreatorToolbarActions } from "./shortlist-creator-toolbar-actions";
import {
  ShortlistCreatorEmptyState,
  ShortlistCreatorList,
} from "./shortlist-creator-list";
import { resolveShortlistClientLabel } from "./shortlist-creator-meta-columns";
import { ShortlistMetricsRefreshBanner } from "./shortlist-metrics-refresh-banner";
import { SubmitShortlistDialog } from "./submit-shortlist-dialog";
import {
  AssignmentStatusBadge,
  ShortlistWorkspaceStatusPill,
} from "./shortlist-badges";
import { ShortlistToolbarButton } from "./shortlist-detail-primitives";


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
  seed,
  campaigns,
  brands,
  clients,
}: {
  detail: ShortlistDetail;
  seed: CampaignSeed;
  campaigns: ShortlistCampaignOption[];
  brands: ShortlistBrandOption[];
  clients: ShortlistClientOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const confirmDelete = useConfirmDelete();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [submitAllOpen, setSubmitAllOpen] = useState(false);
  const [quoteAllOpen, setQuoteAllOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const {
    open: detailOpen,
    creator: detailCreator,
    openCreator,
    onOpenChange: onDetailOpenChange,
    setCreator: setDetailCreator,
  } = useCreatorDetailSheetState();
  const [exportTemplate, setExportTemplate] = useState<ShortlistTemplateVariant>("showcase");
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
  const canEditDetails = detail.canManage && !detail.is_archived && !isMovementLocked(detail.status);
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

  const canCollapseSelected = useMemo(
    () => editable && selectedItemsCanCollapse(selectedItems),
    [editable, selectedItems]
  );

  const canUncollapseSelected = useMemo(
    () => editable && selectedItemsCanUncollapse(selectedItems),
    [editable, selectedItems]
  );

  const existingItems = useMemo(
    () =>
      detail.creators
        .filter((item) => !item.collapse_group_id)
        .map((item) => ({
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

  const handleOpenCreator = useCallback(
    (creator: UnifiedCreatorResult) => {
      const patch = creatorPatches.get(creator.unified_id);
      openCreator(patch ?? creator);
    },
    [creatorPatches, openCreator]
  );

  useEffect(() => {
    setCreatorPatches((prev) => (prev.size === 0 ? prev : new Map()));

    setEnrichmentOverrides((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
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
          changed = true;
        }
      }
      return changed ? next : prev;
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

  // Keep all hooks above event handlers — Fast Refresh can otherwise mismatch hook order
  // after edits when a later useCallback sits below large handler blocks.
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

  function handleBulkCollapse() {
    if (!canCollapseSelected) return;
    runAction(async () => {
      const result = await collapseShortlistCreators(detail.id, selectedItemIdList);
      if (result.ok) clearSelection();
      return result;
    });
  }

  function handleBulkUncollapse() {
    if (!canUncollapseSelected) return;
    runAction(async () => {
      const result = await uncollapseShortlistCreators(detail.id, selectedItemIdList);
      if (result.ok) clearSelection();
      return result;
    });
  }

  const existingQuotationLabel =
    latestQuotation?.serial_number?.trim() ||
    latestQuotation?.name?.trim() ||
    null;

  function handleGenerateNewQuotation() {
    if (detail.creators.length === 0) {
      toast.error("Add creators to this shortlist first.");
      return;
    }
    if (selectedCount > 0) {
      runQuotation(selectedItemIdList);
      return;
    }
    setQuoteAllOpen(false);
    runQuotation();
  }

  function handleAddSelectedToQuotation() {
    if (detail.creators.length === 0) {
      toast.error("Add creators to this shortlist first.");
      return;
    }
    if (selectedCount > 0) {
      handleAddToQuotation(selectedItemIdList);
      return;
    }
    setQuoteAllOpen(false);
    handleAddToQuotation(detail.creators.map((item) => item.item_id));
  }

  function handleGenerateNewVersion() {
    if (!latestQuotation) {
      if (selectedCount === 0) {
        setQuoteAllOpen(true);
        return;
      }
      handleGenerateNewQuotation();
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
    if (selectedCount === 0) {
      setQuoteAllOpen(true);
      return;
    }
    handleGenerateNewQuotation();
  }

  function handleAddToQuotation(itemIds: string | string[]) {
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
    startTransition(async () => {
      try {
        const res = await addShortlistCreatorsToQuotation({
          shortlistId: detail.id,
          itemIds: ids,
        });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message ?? "Added to quotation.");
        if (res.data?.quotationId) {
          router.push(quotationDetailPath(res.data.quotationId));
        } else {
          router.refresh();
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to add creator to quotation."
        );
      }
    });
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

  async function handleBulkRemove() {
    const count = selectedItemIdList.length;
    const ok = await confirmDelete(
      `Remove ${count} selected creator${count === 1 ? "" : "s"} from this shortlist? This cannot be undone.`,
      "Remove from shortlist?"
    );
    if (!ok) return;

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

  const clientLabel = resolveShortlistClientLabel(
    detail.name,
    detail.brand_name,
    detail.client_name
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-background">
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-8 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <h1 className="min-w-0 truncate text-[19px] font-bold tracking-[-0.022em] text-[var(--text)]">
            {detail.name}
            {detail.serial_number ? (
              <span className="ml-2 font-bold uppercase tracking-[0.1em] text-[#9aa3b5] tabular-nums text-[10.5px]">
                {detail.serial_number}
              </span>
            ) : null}
          </h1>
          <ShortlistWorkspaceStatusPill status={detail.status} />
          {canEditDetails ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              disabled={isPending}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted/30 hover:text-[var(--text-2)] disabled:opacity-50"
              aria-label="Edit shortlist"
            >
              <PencilIcon className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <OpenCampaignStudioLauncher
            seed={seed}
            tab="studio"
            workspace={{ type: "shortlist", id: detail.id }}
            variant="ghost"
            size="md"
            showIcon
          />
          <GenerateOutputsLauncher
            seed={seed}
            tab="outputs"
            workspace={{ type: "shortlist", id: detail.id }}
          />
        </div>
      </div>

      <section className={cn(discoverySelectionFlyoutContentClass(selectedCount > 0))}>
        {hasLinkedQuotation ? (
          <div className="border-b border-border px-8 py-2">
            <ShortlistQuotationPanel
              quotations={linkedQuotations}
              onGenerateNewVersion={handleGenerateNewVersion}
              busy={isPending}
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-6 px-8 py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <h2 className="whitespace-nowrap text-[15px] font-extrabold tracking-[-0.02em] text-[var(--text)]">
              Creators{" "}
              <span className="font-medium text-[#9aa3b5]">· {displayCreators.length}</span>
            </h2>

            {clientLabel || detail.brand_name ? (
              <div className="flex min-w-0 items-center gap-2.5 border-l border-border/60 pl-5">
                {clientLabel ? (
                  <span
                    className="truncate text-[13px] font-semibold tracking-[-0.015em] text-foreground"
                    title={clientLabel}
                  >
                    {clientLabel}
                  </span>
                ) : null}
                {clientLabel && detail.brand_name ? (
                  <span
                    aria-hidden
                    className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/55"
                  >
                    ×
                  </span>
                ) : null}
                {detail.brand_name ? (
                  <span
                    className="truncate text-[13px] font-medium tracking-[-0.01em] text-[var(--text-2)]"
                    title={detail.brand_name}
                  >
                    {detail.brand_name}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {detail.creators.length > 0 ? (
              <ShortlistCreatorToolbarActions
                shortlistId={detail.id}
                exportTemplate={exportTemplate}
                onExportTemplateChange={setExportTemplate}
                selectedItemIds={selectedItemIdList}
                exportRevision={detail.updated_at}
                busy={isPending}
              />
            ) : null}
            {editable ? (
              <ShortlistToolbarButton
                variant="primary"
                size="sm"
                onClick={() => setAddOpen(true)}
                disabled={isPending}
              >
                <UserPlusIcon className="size-3.5" />
                Add creators
              </ShortlistToolbarButton>
            ) : null}
            <ShortlistWorkspaceOverflowMenu
              detail={detail}
              selectedCount={selectedCount}
              isPending={isPending}
              onApprove={() => runAction(() => approveShortlist(detail.id))}
              onReturnToDraft={() => runAction(() => rejectShortlist(detail.id))}
              onBulkMove={handleBulkMove}
              onReopen={() => runAction(() => reopenShortlist(detail.id))}
              onCancel={() => runAction(() => cancelShortlist(detail.id))}
              onArchive={() => runAction(() => archiveShortlist(detail.id))}
              onEdit={() => setEditOpen(true)}
              onSubmitForReview={() => setSubmitAllOpen(true)}
              canEditDetails={canEditDetails}
            />
          </div>
        </div>

        {refreshProgress ? (
          <ShortlistMetricsRefreshBanner
            total={refreshProgress.total}
            completed={refreshProgress.completed}
            failed={refreshProgress.failed}
          />
        ) : null}

        {displayCreators.length === 0 ? (
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
            onToggleSelect={(itemId) =>
              setSelectedIds(
                toggleItemSelection(
                  effectiveSelectedIds,
                  itemId,
                  !effectiveSelectedIds.has(itemId)
                )
              )
            }
            onToggleSelectGroup={(itemIds) =>
              setSelectedIds(toggleGroupSelection(itemIds, effectiveSelectedIds))
            }
            onToggleSelectAll={handleToggleSelectAll}
            onOpenCreator={handleOpenCreator}
          />
        )}
      </section>

      {detail.movedAssignments.length > 0 ? (
        <section className="border-t border-border px-8 py-5">
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-[var(--text)]">
            Moved to campaigns
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
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
        </section>
      ) : null}

      <section className="px-8 pb-10 pt-6">
        <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-[var(--text)]">
          Movement history
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
          Audit trail of every creator movement.
        </p>
        {detail.movements.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No movements recorded yet.
          </p>
        ) : (
          <div className="mt-[18px]">
            {detail.movements.map((movement, index) => (
              <div
                key={movement.id}
                className={cn(
                  "relative flex gap-3 py-[11px]",
                  index < detail.movements.length - 1 && "border-b border-border"
                )}
              >
                {index < detail.movements.length - 1 ? (
                  <span
                    className="absolute bottom-[-11px] left-[7px] top-[27px] w-px bg-border"
                    aria-hidden
                  />
                ) : null}
                <span
                  className="relative z-[1] mt-0.5 size-[15px] shrink-0 rounded-full border-[2.5px] border-primary bg-background shadow-[0_0_0_3px_rgba(0,87,255,0.09)]"
                  aria-hidden
                />
                <div className="min-w-0 pb-0.5">
                  <p className="text-[12.5px] font-bold text-[var(--text)]">
                    {MOVEMENT_LABELS[movement.action]}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-3)]">
                    {movement.performed_by_name ? (
                      <span className="font-semibold text-[var(--blue-text)]">
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
      </section>

      <div className="h-10 shrink-0" aria-hidden />

      <ShortlistEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        detail={detail}
        clients={clients}
        brands={brands}
      />

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
        existingQuotationLabel={existingQuotationLabel}
        onGenerateNew={handleGenerateNewQuotation}
        onAddToQuotation={handleAddSelectedToQuotation}
        busy={isPending}
      />

      <AddCreatorsDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        shortlistId={detail.id}
        existingItems={existingItems}
        onAdded={() => router.refresh()}
      />

      <CreatorDetailSheet
        creator={detailCreator}
        open={detailOpen}
        onOpenChange={onDetailOpenChange}
        onCreatorUpdated={(next) => {
          patchCreatorInList(next);
          setDetailCreator(next);
        }}
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
        onGenerateNewQuotation={handleGenerateNewQuotation}
        onAddToQuotation={handleAddSelectedToQuotation}
        existingQuotationLabel={existingQuotationLabel}
        showCollapse={canCollapseSelected}
        onCollapseSelected={handleBulkCollapse}
        showUncollapse={canUncollapseSelected}
        onUncollapseSelected={handleBulkUncollapse}
        onApproveSelected={handleBulkApprove}
        onRejectSelected={handleBulkReject}
        onCancelSelected={handleBulkCancel}
        onClearSelection={clearSelection}
      />
    </div>
  );
}

function ShortlistWorkspaceOverflowMenu({
  detail,
  selectedCount,
  isPending,
  canEditDetails,
  onApprove,
  onReturnToDraft,
  onBulkMove,
  onReopen,
  onCancel,
  onArchive,
  onEdit,
  onSubmitForReview,
}: {
  detail: ShortlistDetail;
  selectedCount: number;
  isPending: boolean;
  canEditDetails: boolean;
  onApprove: () => void;
  onReturnToDraft: () => void;
  onBulkMove: () => void;
  onReopen: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onEdit: () => void;
  onSubmitForReview: () => void;
}) {
  const items: Array<{
    key: string;
    label: string;
    onSelect: () => void;
    destructive?: boolean;
    show: boolean;
  }> = [
    {
      key: "edit",
      label: "Edit shortlist",
      onSelect: onEdit,
      show: canEditDetails,
    },
    {
      key: "submit-all",
      label: "Submit for review",
      onSelect: onSubmitForReview,
      show: detail.status === "draft" && detail.creators.length > 0,
    },
    {
      key: "approve",
      label: "Approve",
      onSelect: onApprove,
      show: detail.status === "under_review" && detail.canApprove,
    },
    {
      key: "return",
      label: "Return to draft",
      onSelect: onReturnToDraft,
      show: detail.status === "under_review" && detail.canApprove,
    },
    {
      key: "move",
      label: `Move to campaign (${selectedCount})`,
      onSelect: onBulkMove,
      show: detail.status === "approved" && selectedCount > 0,
    },
    {
      key: "reopen",
      label: "Reopen",
      onSelect: onReopen,
      show: detail.status === "cancelled",
    },
    {
      key: "cancel",
      label: "Cancel",
      onSelect: onCancel,
      show: detail.status !== "archived" && detail.status !== "cancelled",
    },
    {
      key: "archive",
      label: "Archive",
      onSelect: onArchive,
      destructive: true,
      show: detail.status !== "archived",
    },
  ].filter((item) => item.show);

  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          aria-label="More shortlist actions"
          className="inline-flex size-8 items-center justify-center rounded-[9px] border border-border bg-background text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-50"
        >
          <MoreHorizontalIcon className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((item, index) => {
          const showSeparator =
            item.destructive &&
            index > 0 &&
            !items.slice(0, index).some((prev) => prev.destructive);
          return (
            <div key={item.key}>
              {showSeparator ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant={item.destructive ? "destructive" : "default"}
                disabled={isPending}
                onSelect={(event) => {
                  event.preventDefault();
                  item.onSelect();
                }}
                className="gap-2"
              >
                {item.key === "archive" ? (
                  <ArchiveIcon className="size-3.5" />
                ) : item.key === "cancel" ? (
                  <XCircleIcon className="size-3.5" />
                ) : item.key === "edit" ? (
                  <PencilIcon className="size-3.5" />
                ) : item.key === "submit-all" ? (
                  <SendIcon className="size-3.5" />
                ) : null}
                {item.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
