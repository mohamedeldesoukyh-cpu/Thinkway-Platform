"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorMovementAction } from "@/types/database";

import {
  approveShortlist,
  archiveShortlist,
  cancelShortlist,
  rejectShortlist,
  reopenShortlist,
  removeCreatorFromShortlistV2,
  submitShortlistForReview,
} from "../actions";
import { canEditCreators, canMoveToCampaign } from "../transitions";
import type {
  ShortlistBrandOption,
  ShortlistCampaignOption,
  ShortlistDetail,
} from "../types";
import { createQuotationFromShortlist } from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import { AddCreatorsDrawer } from "./add-creators-drawer";
import { MoveToCampaignDialog } from "./move-to-campaign-dialog";
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [moveOpen, setMoveOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const editable = canEditCreators(detail.status) && !detail.is_archived;
  const movable = canMoveToCampaign(detail.status);
  // Selection drives move (approved), compare, and export across active states.
  const selectable = (editable || movable) && detail.creators.length > 0;

  const selectedItemIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
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
    return detail.creators
      .filter((item) => selected[item.item_id] && item.creator)
      .map((item) => item.creator as UnifiedCreatorResult);
  }

  function handleCompare() {
    const chosen = selectedCreators();
    const pool =
      chosen.length >= 2
        ? chosen
        : (detail.creators
            .map((item) => item.creator)
            .filter(Boolean) as UnifiedCreatorResult[]);
    if (pool.length < 2) {
      toast.error("Select at least 2 creators with resolved profiles to compare.");
      return;
    }
    stashCompareQueue(pool.slice(0, MAX_CREATOR_COMPARE));
    router.push("/discovery/compare");
  }

  function handleExport() {
    const chosen = selectedCreators();
    const pool =
      chosen.length > 0
        ? chosen
        : (detail.creators
            .map((item) => item.creator)
            .filter(Boolean) as UnifiedCreatorResult[]);
    if (pool.length === 0) {
      toast.error("No creator data available to export.");
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

  function handleGenerateQuotation() {
    startTransition(async () => {
      const res = await createQuotationFromShortlist(detail.id);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Quotation created.");
      if (res.data?.id) router.push(quotationDetailPath(res.data.id));
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
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
                  onClick={() => runAction(() => submitShortlistForReview(detail.id))}
                  disabled={isPending}
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
              {detail.status === "approved" ? (
                <Button
                  size="sm"
                  onClick={() => setMoveOpen(true)}
                  disabled={isPending || selectedItemIds.length === 0}
                >
                  Move to campaign ({selectedItemIds.length})
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
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Creators ({detail.creators.length})</CardTitle>
              <CardDescription>
                {movable
                  ? "Select creators, then move them to a campaign."
                  : editable
                    ? "Search and add creators, compare, then submit for review."
                    : "Creators are locked in the current status."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editable ? (
                <Button size="sm" onClick={() => setAddOpen(true)} disabled={isPending}>
                  <UserPlusIcon className="size-4" />
                  Add creators
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={handleCompare}
                disabled={detail.creators.length < 2}
              >
                <GitCompareArrowsIcon className="size-4" />
                Compare
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
                disabled={detail.creators.length === 0}
              >
                <DownloadIcon className="size-4" />
                Export
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateQuotation}
                disabled={detail.creators.length === 0 || isPending}
              >
                <FileTextIcon className="size-4" />
                Generate Quotation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
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
            detail.creators.map((item) => {
              const platform = item.creator?.platforms?.[0];
              return (
                <div
                  key={item.item_id}
                  className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2"
                >
                  {selectable ? (
                    <Checkbox
                      checked={Boolean(selected[item.item_id])}
                      onCheckedChange={(value) =>
                        setSelected((prev) => ({
                          ...prev,
                          [item.item_id]: Boolean(value),
                        }))
                      }
                      aria-label="Select creator"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.creator?.display_name ?? "Unknown creator"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {platform
                        ? `${platform.platform} · @${platform.handle}`
                        : item.unified_id ?? "—"}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </p>
                  </div>
                  {item.creator?.metrics?.followers?.value != null ? (
                    <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                      {Intl.NumberFormat().format(
                        item.creator.metrics.followers.value
                      )}{" "}
                      followers
                    </span>
                  ) : null}
                  {editable ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() =>
                        runAction(() =>
                          removeCreatorFromShortlistV2(detail.id, item.item_id)
                        )
                      }
                      disabled={isPending}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              );
            })
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
        selectedItemIds={selectedItemIds}
        campaigns={campaigns}
        brands={brands}
      />

      <AddCreatorsDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        shortlistId={detail.id}
        existingItems={existingItems}
        onAdded={() => router.refresh()}
      />
    </div>
  );
}
