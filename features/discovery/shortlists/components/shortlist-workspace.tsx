"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useEscapeClearSelection } from "@/lib/hooks/use-escape-clear-selection";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { EntityPrevNext } from "@/components/navigation/entity-prev-next";
import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CampaignSeed } from "@/features/campaign-outputs/hydration/hydration-types";

import { createClientReviewFromShortlistAction } from "@/features/client-workspace/actions/create-from-shortlist-action";
import {
  peekClientReviewShareAction,
  revealClientReviewLinkAction,
} from "@/features/client-workspace/actions/reveal-client-review-link-action";
import { ClientReviewShareDialog } from "@/features/client-workspace/components/client-review-share-dialog";
import {
  readClientReviewShare,
  rememberClientReviewShare,
  reviewIdFromShareUrl,
} from "@/features/client-workspace/client-review-share-memory";
import { CLIENT_REVIEW_LINK_MISSING_MESSAGE } from "@/features/client-workspace/constants";
import { clientReviewShareHasLink } from "@/features/client-workspace/client-review-selection";
import "@/app/styles/shortlist-detail.css";
import "@/app/styles/shortlist-redesign.css";
import "@/app/styles/shortlist-redesign-integration.css";
import { discoverySelectionFlyoutContentClass } from "@/features/discovery/components/design-system/discovery-selection-flyout";
import { SHORTLIST_STATUS_LABELS, shortlistDetailPath } from "@/features/discovery/shortlists/constants";
import { cn } from "@/lib/utils";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import { useCreatorDetailSheetState } from "@/features/discovery/hooks/use-creator-detail-sheet-state";
import { stashCompareQueue } from "@/features/discovery/components/creator-search/creator-search-utils";
import { refreshCreatorAllAction, getUnifiedCreatorAfterRefreshAction } from "@/features/discovery/enrichment/actions";
import {
  invokeRefreshAction,
  mapManualRefreshError,
  rethrowNextControlFlow,
} from "@/features/discovery/enrichment/manual-refresh-error";
import { ManualRefreshConfirmDialog } from "@/features/discovery/enrichment/components/manual-refresh-confirm-dialog";
import type { ManualRefreshDataSource } from "@/lib/creator-enrichment/manual-refresh-policy";
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
import { formatDiscoveryDateTime } from "@/lib/discovery/format-discovery-date";
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
  setShortlistHideCostAndFees,
  setShortlistShowOriginalCurrency,
  updateShortlistDetails,
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
import { ShortlistHeaderActions } from "./shortlist-header-actions";
import { CreatorListCostControl } from "./creator-list-cost-control";
import {
  ShortlistCreatorEmptyState,
  ShortlistCreatorList,
} from "./shortlist-creator-list";
import { resolveShortlistClientLabel } from "./shortlist-creator-meta-columns";
import { ShortlistMetricsRefreshBanner } from "./shortlist-metrics-refresh-banner";
import { useLiveShortlistEnrichment } from "../use-live-shortlist-enrichment";
import type { getShortlistEnrichmentUpdates } from "../enrichment-live-action";
import { SubmitShortlistDialog } from "./submit-shortlist-dialog";
import {
  AssignmentStatusBadge,

} from "./shortlist-badges";



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
  useEscapeClearSelection(selectedIds.size > 0, () => setSelectedIds(new Set()));
  const [moveOpen, setMoveOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"search" | "paste">("search");
  const [submitAllOpen, setSubmitAllOpen] = useState(false);
  const [quoteAllOpen, setQuoteAllOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareReviewNumber, setShareReviewNumber] = useState<number | undefined>(undefined);
  const [hasLink, setHasLink] = useState(() =>
    Boolean(readClientReviewShare({ source: "shortlist", id: detail.id }))
  );
  const [showOriginalCurrency, setOptimisticShowOriginalCurrency] = useOptimistic(
    Boolean(detail.showOriginalCurrency)
  );
  const [hideCostAndFees, setOptimisticHideCostAndFees] = useOptimistic(
    Boolean(detail.hideCostAndFees)
  );
  const {
    open: detailOpen,
    creator: detailCreator,
    openCreator,
    openCreatorByHandle,
    onOpenChange: onDetailOpenChange,
    setCreator: setDetailCreator,
  } = useCreatorDetailSheetState();
  const [exportTemplate, setExportTemplate] = useState<ShortlistTemplateVariant>("detailed");
  const [displayCurrency, setDisplayCurrency] = useState(
    () => (detail.currency || "EGP").toUpperCase()
  );
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

  const [refreshTargets, setRefreshTargets] = useState<Array<{ unifiedId: string; influencerId: string }>>([]);

  const refreshingMetrics = refreshProgress != null && refreshProgress.completed < refreshProgress.total;

  useEffect(() => {
    setDisplayCurrency((detail.currency || "EGP").toUpperCase());
  }, [detail.currency]);

  useEffect(() => {
    const scope = { source: "shortlist" as const, id: detail.id };
    setHasLink(Boolean(readClientReviewShare(scope)));
    void peekClientReviewShareAction({ source: "shortlist", shortlistId: detail.id }).then((result) => {
      setHasLink(clientReviewShareHasLink(result.exists, Boolean(readClientReviewShare(scope))));
      if (result.reviewNumber != null) setShareReviewNumber(result.reviewNumber);
    });
  }, [detail.id]);

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      const next = currency.toUpperCase();
      setDisplayCurrency(next);
      startTransition(async () => {
        const result = await updateShortlistDetails({
          shortlistId: detail.id,
          currency: next,
        });
        if (!result.ok) {
          toast.error(result.message);
          setDisplayCurrency((detail.currency || "EGP").toUpperCase());
          return;
        }
        toast.success(result.message ?? "Currency updated.");
        router.refresh();
      });
    },
    [detail.id, detail.currency, router]
  );

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
      for (const item of detail.creators) {
        if (next.influencer_id && (item.influencer_id ?? item.creator?.influencer_id) === next.influencer_id) {
          map.set(item.unified_id ?? next.unified_id, next);
        }
      }
      return map;
    });
  }, [detail.creators]);

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

  const applyEnrichmentUpdates = useCallback((updates: Awaited<ReturnType<typeof getShortlistEnrichmentUpdates>>) => {
    setCreatorPatches((previous) => {
      const next = new Map(previous);
      for (const update of updates) next.set(update.unifiedId, update.creator);
      return next;
    });
  }, []);
  const enrichmentConnectionDelayed = useLiveShortlistEnrichment(
    detail.id, displayCreators, applyEnrichmentUpdates, refreshingMetrics,
  );

  /** Handle-only open (pack cr) — shortlist items first, then any patched creators. */
  const handleOpenCreatorByHandle = useCallback(
    (handleOrId: string) => {
      const shortlistPool = displayCreators
        .map((item) => item.creator)
        .filter((c): c is UnifiedCreatorResult => Boolean(c));
      const patched = [...creatorPatches.values()];
      return openCreatorByHandle(handleOrId, shortlistPool, patched);
    },
    [creatorPatches, displayCreators, openCreatorByHandle]
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
        if (res.data?.id) {
          router.push(quotationDetailPath(res.data.id, res.data.serial_number));
        }
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
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function handleRefreshMetrics() {
    if (refreshingMetrics) return;
    const pool = selectedCount > 0
      ? displayCreators.filter((item) => selectedItems.some((selected) => selected.item_id === item.item_id))
      : displayCreators;
    const targets = new Map<string, { unifiedId: string; influencerId: string }>();
    for (const item of pool) {
      const unifiedId = item.unified_id ?? item.creator?.unified_id;
      const influencerId = item.influencer_id ?? item.creator?.influencer_id;
      if (unifiedId && influencerId) targets.set(influencerId, { unifiedId, influencerId });
    }
    if (!targets.size) { toast.error("No creators with linked vendor profiles to refresh."); return; }
    setRefreshTargets([...targets.values()]);
  }

  async function executeSelectedRefresh(dataSource: ManualRefreshDataSource) {
    const targets = refreshTargets;
    setRefreshTargets([]);
    setRefreshProgress({ total: targets.length, completed: 0, failed: 0 });
    setEnrichmentOverrides(new Map(targets.map((target) => [target.unifiedId, "queued"])));
    let failed = 0;
    // Same full-creator action as details, without a platform restriction.
    // At most three creators active, including completion polling.
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, async () => {
      while (cursor < targets.length) {
        const target = targets[cursor++];
        let didFail = false;
        try {
          const result = await invokeRefreshAction(() => refreshCreatorAllAction(target.influencerId, dataSource));
          if (!result.ok) {
            // A multi-platform cached refresh can update one account and miss another.
            const creator = await getUnifiedCreatorAfterRefreshAction(target.unifiedId);
            if (creator) patchCreatorInList(creator);
            throw new Error(result.message);
          }
          if (result.queued) {
            await pollCreatorsAfterBatchRefresh([target], {
              onUpdated: patchCreatorInList,
              onStatusChange: ({ unifiedId, status }) => setEnrichmentOverrides((prev) =>
                new Map(prev).set(unifiedId, syncStatusToEnrichmentStatus(status))),
              onComplete: ({ status }) => { didFail = status === "failed"; },
            });
          } else {
            const creator = await getUnifiedCreatorAfterRefreshAction(target.unifiedId);
            if (creator) patchCreatorInList(creator);
          }
        } catch (error) {
          rethrowNextControlFlow(error);
          didFail = true;
          toast.error(mapManualRefreshError(error));
        } finally {
          if (didFail) failed++;
          setEnrichmentOverrides((prev) => { const next = new Map(prev); next.delete(target.unifiedId); return next; });
          setRefreshProgress((prev) => prev ? { ...prev, completed: prev.completed + 1, failed: prev.failed + Number(didFail) } : null);
        }
      }
    }));
    if (failed) toast.error(failed + " of " + targets.length + " creator refreshes could not complete.");
    else toast.success("Creator data updated across linked platforms");
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

  function rememberShortlistShare(url: string, reviewNumber: number) {
    setShareUrl(url);
    setShareReviewNumber(reviewNumber);
    setHasLink(true);
    const reviewId = reviewIdFromShareUrl(url);
    if (reviewId) {
      rememberClientReviewShare(
        { source: "shortlist", id: detail.id },
        { url, reviewNumber, reviewId }
      );
    }
  }

  async function generateShortlistClientReview() {
    const eligible = detail.creators.filter((item) => item.item_status !== "cancelled");
    if (eligible.length === 0) {
      toast.error("Add at least one creator before generating a Client Workspace link.");
      return;
    }
    const result = await createClientReviewFromShortlistAction({
      shortlistId: detail.id,
      selectedItemIds: eligible.map((item) => item.item_id),
    });
    if (!result.ok) {
      toast.error(result.message, {
        description: result.blockers.slice(0, 4).join(" "),
      });
      return;
    }
    rememberShortlistShare(result.url, result.reviewNumber);
    setShareOpen(true);
  }

  function handleShowLink() {
    startTransition(async () => {
      const cached = readClientReviewShare({ source: "shortlist", id: detail.id });
      if (cached) {
        setShareUrl(cached.url);
        setShareReviewNumber(cached.reviewNumber);
        setHasLink(true);
        setShareOpen(true);
        return;
      }
      const result = await revealClientReviewLinkAction({
        source: "shortlist",
        shortlistId: detail.id,
      });
      if (result.ok) {
        rememberShortlistShare(result.url, result.reviewNumber);
        setShareOpen(true);
        return;
      }
      if (result.message !== CLIENT_REVIEW_LINK_MISSING_MESSAGE) {
        toast.error(result.message);
        return;
      }
      await generateShortlistClientReview();
    });
  }

  function handleSendToClient() {
    const eligible = detail.creators.filter((item) => item.item_status !== "cancelled");
    if (eligible.length === 0) {
      toast.error("Select at least one creator to send to the client.");
      return;
    }
    const itemIds =
      selectedCount > 0
        ? selectedItemIdList
        : eligible.map((item) => item.item_id);
    if (itemIds.length === 0) {
      toast.error("Select at least one creator to send to the client.");
      return;
    }
    startTransition(async () => {
      const result = await createClientReviewFromShortlistAction({
        shortlistId: detail.id,
        selectedItemIds: itemIds,
      });
      if (!result.ok) {
        toast.error(result.message, {
          description: result.blockers.slice(0, 4).join(" "),
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
      } catch {
        /* clipboard is optional — the share dialog still shows the URL */
      }
      rememberShortlistShare(result.url, result.reviewNumber);
      setShareOpen(true);
      toast.success(result.message);
      router.refresh();
    });
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
  /** Pack Creators card subtitle: client · brand (HTML pgShortlist). */
  const creatorsCardSubtitle = [clientLabel, detail.brand_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
  const quotedCount = detail.creators.filter(
    (item) => item.quotation_refs.length > 0
  ).length;
  const underReviewCount = detail.creators.filter(
    (item) => item.item_status === "under_review"
  ).length;
  const approvedCount = detail.creators.filter(
    (item) => item.item_status === "approved" || item.item_status === "moved_to_campaign"
  ).length;
  const mastheadMetrics = [
    { label: "Creators", value: detail.creators.length, caption: "" },
    { label: "Quoted", value: quotedCount, caption: "linked to a quotation" },
    { label: "Under review", value: underReviewCount, caption: "" },
    { label: "Approved", value: approvedCount, caption: "includes moved to campaign" },
    { label: "Rejected", value: detail.creators.filter(item => item.item_status === "rejected").length, caption: "" },
  ];

  return (
    <div className="sl-redesign shortlist-detail-workspace discovery-suite flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
      <ManualRefreshConfirmDialog
        open={refreshTargets.length > 0}
        onOpenChange={(open) => { if (!open) setRefreshTargets([]); }}
        assessment={null}
        scopeLabel="All creator data"
        title={"Refresh " + refreshTargets.length + " creators"}
        description="Refresh all linked platforms, including avatars and metrics. Use cached data for free; platforms without a usable snapshot will be reported. Refresh Live fetches new data and uses Apify credits."
        onChoose={(source) => { void executeSelectedRefresh(source); }}
      />
      <header className="sl-head"><div className="sl-head__in">
        <div className="sl-head__nav">
          <Link className="q-b q-b--sm q-b--ghost" href="/discovery/shortlists">← Back to shortlists</Link>
          <span className="sl-crumb"><Link href="/discovery">Discovery</Link><span>/</span><Link href="/discovery/shortlists">Shortlists</Link><span>/</span><b>{detail.serial_number}</b></span>
          <span className="q-sp" />
          <div className="sl-nav"><EntityPrevNext entity="shortlists" currentId={detail.id} hrefForId={(id) => shortlistDetailPath(id)} /></div>
        </div>
        <div className="sl-head__t">
          <span className="sl-ref">{detail.serial_number}</span><h1>{detail.name}</h1>
          <span className={cn("q-p", detail.status === "approved" ? "q-p--ok" : detail.status === "under_review" ? "q-p--wrn" : "")}><s />{SHORTLIST_STATUS_LABELS[detail.status]}</span>
          {canEditDetails && <button type="button" className="q-b q-b--sm q-b--icon" aria-label="Edit shortlist" disabled={isPending} onClick={() => setEditOpen(true)}><PencilIcon className="size-3.5" /></button>}
        </div>
        <div className="sl-head__ctx"><b>{clientLabel ?? "No client linked"}</b>{detail.brand_name && <><span className="sl-dot" /><span>{detail.brand_name}</span></>}</div>
        <div className="sl-tools">
            <ShortlistHeaderActions
          seed={seed}
          shortlistId={detail.id}
          creators={detail.creators}
          exportTemplate={exportTemplate}
          onExportTemplateChange={setExportTemplate}
          selectedItemIds={selectedItemIdList}
          onSelectedItemIdsChange={(itemIds) => setSelectedIds(new Set(itemIds))}
          exportRevision={detail.updated_at}
          displayCurrency={displayCurrency}
          onCurrencyChange={handleCurrencyChange}
          showOriginalCurrency={showOriginalCurrency}
          hideCostAndFees={hideCostAndFees}
          onShowOriginalCurrencyChange={(value) => {
            startTransition(async () => {
              setOptimisticShowOriginalCurrency(value);
              const result = await setShortlistShowOriginalCurrency({
                shortlistId: detail.id,
                value,
              });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              router.refresh();
            });
          }}
          onHideCostAndFeesChange={(value) => {
            startTransition(async () => {
              setOptimisticHideCostAndFees(value);
              const result = await setShortlistHideCostAndFees({
                shortlistId: detail.id,
                value,
              });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              router.refresh();
            });
          }}
          canManageView={detail.canManage}
          canChangeCurrency={canEditDetails}
          hasLink={hasLink}
          canSendToClient={detail.creators.some((item) => item.item_status !== "cancelled")}
          canAddCreators={editable && detail.canManage}
          busy={isPending}
          onShowLink={handleShowLink}
          onSendToClient={handleSendToClient}
          onAddCreators={() => {
            setAddMode("search");
            setAddOpen(true);
          }}
          overflow={
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
          }
            />
        </div>
      </div></header>
      <div className="sl-wrap">
        <div className="sl-sum" aria-label="Shortlist summary">
          {mastheadMetrics.map(m => <div className="sl-m" key={m.label}><u>{m.label}</u><b className={m.value === 0 ? "z" : undefined}>{m.value}</b>{m.caption && <em>{m.caption}</em>}</div>)}
          <div className="sl-m"><u>Latest quotation</u>{latestQuotation ? <><Link href={quotationDetailPath(latestQuotation.id, latestQuotation.serial_number)}>{latestQuotation.serial_number ?? latestQuotation.name}</Link><em>v{latestQuotation.version_number} · of the quotation</em></> : <b className="z">—</b>}</div>
          <CreatorListCostControl key={detail.id} shortlistId={detail.id} value={detail.creatorListCost} disabled={!canEditDetails} />
        </div>
        {!canEditDetails && <div className="sl-ro" role="status">{detail.is_archived || detail.status === "archived" ? "Archived shortlist" : detail.status === "cancelled" ? "Cancelled shortlist" : "Read-only access"} · editing is unavailable.</div>}


      <section
        className={cn(
          "sl-content",
          discoverySelectionFlyoutContentClass(selectedCount > 0)
        )}
      >
        {hasLinkedQuotation ? (
          <ShortlistQuotationPanel
            quotations={linkedQuotations}
            onGenerateNewVersion={handleGenerateNewVersion}
            busy={isPending}
          />
        ) : null}

        <div className="tw-c sl-creator-card">
            <div className="tw-ch sl-tbl__h">
              <span className="tw-ct">Creators · {displayCreators.length}</span>
              {creatorsCardSubtitle ? (
                <span className="tw-cs">{creatorsCardSubtitle}</span>
              ) : null}
              <span className="tw-sp" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="tw-b sm" aria-label="Creator list actions"><MoreHorizontalIcon className="size-4" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={!editable || selectedCount === 0 || isPending} onSelect={() => runAction(() => bulkSubmitCreatorsForReview(detail.id, selectedItemIdList))}>Submit {selectedCount} selected</DropdownMenuItem>
                  <DropdownMenuItem disabled={isPending} onSelect={handleCompare}>Compare</DropdownMenuItem>
                  <DropdownMenuItem disabled={isPending || refreshingMetrics} onSelect={handleRefreshMetrics}>Refresh metrics</DropdownMenuItem>
                  <DropdownMenuItem disabled={isPending || displayCreators.length === 0} onSelect={handleExportSelected}>Export CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                className="tw-b sm"
                disabled={isPending || displayCreators.length === 0}
                onClick={() => {
                  if (selectedCount > 0) {
                    handleGenerateNewQuotation();
                    return;
                  }
                  setQuoteAllOpen(true);
                }}
              >
                Generate quotation
              </button>
              {editable && detail.canManage && <button type="button" className="tw-b sm pri" disabled={isPending} onClick={() => { setAddMode("search"); setAddOpen(true); }}>+ Add creator</button>}
            </div>

            {enrichmentConnectionDelayed ? (
              <p role="status" className="px-4 py-2 text-sm text-amber-700">
                Creator updates are temporarily delayed. Retrying automatically…
              </p>
            ) : null}
            {refreshProgress ? (
              <ShortlistMetricsRefreshBanner
                total={refreshProgress.total}
                completed={refreshProgress.completed}
                failed={refreshProgress.failed}
              />
            ) : null}

            {displayCreators.length === 0 ? (
              <ShortlistCreatorEmptyState
                editable={editable && detail.canManage}
                onAddCreators={() => {
                  setAddMode("search");
                  setAddOpen(true);
                }}
                onPasteLinks={() => {
                  setAddMode("paste");
                  setAddOpen(true);
                }}
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
                onOpenCreator={(creator) => {
                  const handle =
                    creator.platforms.find((p) => p.handle)?.handle?.replace(/^@+/, "") ??
                    creator.unified_id;
                  if (!handleOpenCreatorByHandle(handle)) {
                    handleOpenCreator(creator);
                  }
                }}
              />
            )}
        </div>
      </section>

      {detail.movedAssignments.length > 0 ? (
        <section className="sl-secondary">
          <details className="q-card sl-acc">
            <summary>
              <span>Moved to campaigns</span>
              <span className="tw-cs">
                Creators moved from this shortlist and their current assignment status.
              </span>
            </summary>
            <div className="tw-pad space-y-2">
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
          </details>
        </section>
      ) : null}

      <section className="sl-secondary">
        <details className="q-card sl-acc" open>
          <summary>
            <span>Movement history</span>
            <small>audit trail of every creator movement</small>
          </summary>
          {detail.movements.length === 0 ? (
            <p className="tw-pad tw-miss">No movements recorded yet.</p>
          ) : (
            <div className="tw-ms">
              {detail.movements.map((movement) => (
                <div key={movement.id} className="tw-mi">
                  <span>
                    <span className="tw-dot on" aria-hidden />
                  </span>
                  <span>
                    <b style={{ fontSize: "12.5px", fontWeight: 600 }}>
                      {MOVEMENT_LABELS[movement.action]}
                      {movement.notes ? ` · ${movement.notes}` : ""}
                    </b>
                  </span>
                  <span className="tw-t">
                    {movement.performed_by_name || "System"}
                  </span>
                  <span className="tw-d">
                    {formatDiscoveryDateTime(movement.performed_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </details>
      </section>

      </div>

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
        initialMode={addMode}
      />

      <CreatorDetailSheet
        similarTarget={{kind: "shortlist", id: detail.id, canAdd: editable}}
        creator={detailCreator}
        open={detailOpen}
        onOpenChange={onDetailOpenChange}
        onCreatorUpdated={(next) => {
          patchCreatorInList(next);
          setDetailCreator(next);
        }}
        presentation="discoveryPack"
      />

      <ShortlistBulkToolbar
        selectedCount={selectedCount}
        totalCount={detail.creators.length}
        onSelectAll={() => setSelectedIds(new Set(visibleItemIds))}
        canManage={detail.canManage && !isMovementLocked(detail.status)}
        showSubmit={editable && detail.canManage}
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
        onSendToClient={handleSendToClient}
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
      <ClientReviewShareDialog
        campaignName={detail.name}
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        reviewNumber={shareReviewNumber}
        status={detail.status}
        version={shareReviewNumber != null ? `v${shareReviewNumber}` : null}
        documentLabel={detail.serial_number ?? detail.name}
        linkEnabled={hasLink}
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
          className="inline-flex size-[34px] items-center justify-center rounded-[10px] border-[0.8px] border-[#E3E8F2] bg-white text-[#41495A] transition-[border-color,color] hover:border-[rgba(0,87,255,0.35)] hover:text-[#0B52E0] disabled:opacity-45 dark:border-border dark:bg-background dark:text-[var(--text-2)]"
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
