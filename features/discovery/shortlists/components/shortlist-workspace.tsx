"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  SendIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { glassFlyoutContentClass } from "@/components/shared/navigation/glass-selection-flyout";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  exportCreatorsCsv,
  stashCompareQueue,
} from "@/features/discovery/components/creator-search/creator-search-utils";
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
import { ShortlistCreatorList } from "./shortlist-creator-list";
import { SubmitShortlistDialog } from "./submit-shortlist-dialog";
import {
  AssignmentStatusBadge,
  ShortlistStatusBadge,
  ShortlistVisibilityBadge,
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

  function selectedCreators(): UnifiedCreatorResult[] {
    return selectedItems
      .filter((item) => item.creator)
      .map((item) => item.creator as UnifiedCreatorResult);
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleCompare() {
    const pool = selectedCount > 0 ? selectedCreators() : detail.creators.filter((i) => i.creator).map((i) => i.creator!);
    if (pool.length < 2) {
      toast.error("Select at least 2 creators with resolved profiles to compare.");
      return;
    }
    stashCompareQueue(pool.slice(0, MAX_CREATOR_COMPARE));
    router.push("/discovery/compare");
  }

  function handleExport() {
    const pool = selectedCount > 0 ? selectedCreators() : detail.creators.filter((i) => i.creator).map((i) => i.creator!);
    if (pool.length === 0) {
      toast.error("No creators with resolved profiles to export.");
      return;
    }
    const csv = exportCreatorsCsv(pool);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${detail.serial_number ?? "shortlist"}-creators.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${pool.length} creator(s)`);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-mono text-xs text-muted-foreground">
                {detail.serial_number ?? "—"}
              </p>
              <CardTitle className="text-2xl">{detail.name}</CardTitle>
              {detail.description ? (
                <CardDescription>{detail.description}</CardDescription>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ShortlistStatusBadge status={detail.status} />
                <ShortlistVisibilityBadge visibility={detail.visibility} />
                <span className="text-xs text-muted-foreground">
                  Owner: {detail.owner_name ?? "—"}
                </span>
                {detail.brand_name ? (
                  <span className="text-xs text-muted-foreground">
                    · {detail.brand_name}
                    {detail.client_name ? ` (${detail.client_name})` : ""}
                  </span>
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

            <div className="flex flex-wrap items-center gap-2">
              {detail.status === "draft" ? (
                <Button
                  size="sm"
                  onClick={handleSubmitForReview}
                  disabled={isPending || detail.creators.length === 0}
                >
                  <SendIcon className="size-4" />
                  Submit for review
                </Button>
              ) : null}
              {detail.status === "under_review" && detail.canApprove ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => runAction(() => approveShortlist(detail.id))}
                    disabled={isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(() => rejectShortlist(detail.id))}
                    disabled={isPending}
                  >
                    Return to draft
                  </Button>
                </>
              ) : null}
              {detail.status === "approved" && selectedCount > 0 ? (
                <Button size="sm" onClick={handleBulkMove} disabled={isPending}>
                  Move to campaign ({selectedCount})
                </Button>
              ) : null}
              {detail.status === "cancelled" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runAction(() => reopenShortlist(detail.id))}
                  disabled={isPending}
                >
                  Reopen
                </Button>
              ) : null}
              {detail.status !== "archived" &&
              detail.status !== "cancelled" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => runAction(() => cancelShortlist(detail.id))}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              ) : null}
              {detail.status !== "archived" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => runAction(() => archiveShortlist(detail.id))}
                  disabled={isPending}
                >
                  Archive
                </Button>
              ) : null}
            </div>
          </div>
          {hasLinkedQuotation ? (
            <ShortlistQuotationPanel
              quotations={linkedQuotations}
              onGenerateNewVersion={handleGenerateNewVersion}
              busy={isPending}
            />
          ) : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>Creators ({detail.creators.length})</CardTitle>
                {selectable ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={allSelected ? true : indeterminate ? "indeterminate" : false}
                      onCheckedChange={(value) =>
                        setSelectedIds(
                          toggleSelectAll(visibleItemIds, effectiveSelectedIds, Boolean(value))
                        )
                      }
                      aria-label="Select all creators"
                    />
                    Select all
                  </label>
                ) : null}
              </div>
              <CardDescription>
                Discovery-style creator rows with review status. Select creators for bulk actions.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {detail.creators.length > 0 ? (
                <>
                  {hasLinkedQuotation ? (
                    <ShortlistQuotationActions
                      quotations={linkedQuotations}
                      onGenerateNewVersion={handleGenerateNewVersion}
                      busy={isPending}
                    />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateQuotation}
                      disabled={isPending}
                    >
                      <FileTextIcon className="size-4" />
                      Generate quotation
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleCompare} disabled={isPending}>
                    <GitCompareArrowsIcon className="size-4" />
                    Compare
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExport} disabled={isPending}>
                    <DownloadIcon className="size-4" />
                    Export
                  </Button>
                </>
              ) : null}
              {editable ? (
                <Button size="sm" onClick={() => setAddOpen(true)} disabled={isPending}>
                  <UserPlusIcon className="size-4" />
                  Add creators
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn("space-y-2", glassFlyoutContentClass(selectedCount > 0))}>
          {detail.creators.length === 0 ? (
            <div className="space-y-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No creators yet.
                {editable
                  ? " Click “Add creators” to search and build this shortlist."
                  : " This shortlist is locked in its current status."}
              </p>
              {editable ? (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <UserPlusIcon className="size-4" />
                  Add creators
                </Button>
              ) : null}
            </div>
          ) : (
            <ShortlistCreatorList
              items={detail.creators}
              selectedIds={effectiveSelectedIds}
              selectable={selectable}
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
              onRemove={(itemId) =>
                runAction(() => removeCreatorFromShortlistV2(detail.id, itemId))
              }
              onAddToQuotation={handleAddToQuotation}
            />
          )}
        </CardContent>
      </Card>

      {detail.movedAssignments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Moved to campaigns</CardTitle>
            <CardDescription>
              Creators moved from this shortlist and their current assignment status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.movedAssignments.map((assignment) => (
              <div
                key={assignment.assignment_id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2 text-sm"
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
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Movement history</CardTitle>
          <CardDescription>Audit trail of every creator movement.</CardDescription>
        </CardHeader>
        <CardContent>
          {detail.movements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No movements recorded yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {detail.movements.map((movement) => (
                <li key={movement.id} className="flex gap-3 text-sm">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {MOVEMENT_LABELS[movement.action]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {movement.performed_by_name ?? "System"}
                      {" · "}
                      {format(new Date(movement.performed_at), "MMM d, yyyy HH:mm")}
                      {movement.notes ? ` · ${movement.notes}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Separator className="opacity-0" />

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
        busy={isPending}
        onSubmitSelected={() =>
          runAction(() => bulkSubmitCreatorsForReview(detail.id, selectedItemIdList))
        }
        onRemoveSelected={handleBulkRemove}
        onCompareSelected={handleCompare}
        onExportSelected={handleExport}
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
