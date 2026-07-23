import Link from "next/link";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { Badge } from "@/components/ui/badge";
import {
  QUOTATION_STATUS_LABELS,
  quotationDetailPath,
} from "@/features/quotations/constants";
import { cn } from "@/lib/utils";
import type {
  CampaignShortlistAssignmentStatus,
  ShortlistItemStatus,
  ShortlistStatus,
  ShortlistVisibilityV2,
} from "@/types/database";

import {
  ASSIGNMENT_STATUS_LABELS,
  SHORTLIST_ITEM_STATUS_LABELS,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import type { ShortlistCreatorQuotationRef } from "../types";

export function ShortlistListStatusPill({ status }: { status: ShortlistStatus }) {
  return (
    <span className="inline-flex h-[23px] items-center rounded-[7px] bg-muted/50 px-2.5 text-[11.5px] font-semibold text-[var(--text-2)] dark:bg-muted/30">
      {SHORTLIST_STATUS_LABELS[status]}
    </span>
  );
}

export function ShortlistListVisibilityPill({
  visibility,
}: {
  visibility: ShortlistVisibilityV2;
}) {
  return (
    <span className="inline-flex h-[23px] items-center rounded-[7px] border border-border bg-transparent px-2.5 text-[11.5px] font-semibold text-[var(--text-3)]">
      {SHORTLIST_VISIBILITY_LABELS[visibility]}
    </span>
  );
}

export function ShortlistWorkspaceStatusPill({ status }: { status: ShortlistStatus }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-[7px] bg-muted/50 px-2.5 text-[11.5px] font-semibold text-[var(--text-2)] dark:bg-muted/30">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full bg-muted-foreground/70",
          status === "draft" && "bg-slate-400"
        )}
        aria-hidden
      />
      {SHORTLIST_STATUS_LABELS[status]}
    </span>
  );
}

export function ShortlistStatusBadge({ status }: { status: ShortlistStatus }) {
  return (
    <StatusBadge
      label={SHORTLIST_STATUS_LABELS[status]}
      tone={resolveStatusTone("shortlist", status)}
      appearance="ghost"
      className={cn(status === "archived" && "line-through")}
    />
  );
}

export function ShortlistVisibilityBadge({
  visibility,
}: {
  visibility: ShortlistVisibilityV2;
}) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {SHORTLIST_VISIBILITY_LABELS[visibility]}
    </Badge>
  );
}

export function ShortlistItemStatusBadge({
  status,
  variant = "default",
}: {
  status: ShortlistItemStatus;
  variant?: "default" | "table";
}) {
  if (variant === "table") {
    return (
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold",
          status === "draft" && "border-border bg-muted/60 text-muted-foreground",
          status === "under_review" &&
            "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
          status === "approved" &&
            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
          status === "rejected" &&
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
          (status === "moved_to_campaign" || status === "cancelled") &&
            "border-border bg-muted/60 text-muted-foreground",
          status === "cancelled" && "line-through"
        )}
      >
        {SHORTLIST_ITEM_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <StatusBadge
      label={SHORTLIST_ITEM_STATUS_LABELS[status]}
      tone={resolveStatusTone("shortlistItem", status)}
      appearance="ghost"
      className={cn(status === "cancelled" && "line-through")}
    />
  );
}

export function AssignmentStatusBadge({
  status,
}: {
  status: CampaignShortlistAssignmentStatus | null;
}) {
  if (!status) return null;
  return (
    <StatusBadge
      label={ASSIGNMENT_STATUS_LABELS[status]}
      tone={resolveStatusTone("shortlistAssignment", status)}
      appearance="ghost"
      className={cn(status === "removed" && "line-through")}
    />
  );
}

function quotationBadgeLabel(ref: ShortlistCreatorQuotationRef): string {
  if (ref.serial_number?.trim()) return ref.serial_number.trim();
  return ref.name.trim() || "Quotation";
}

export function ShortlistCreatorQuotedBadge({
  refs,
  variant = "table",
}: {
  refs: ShortlistCreatorQuotationRef[];
  variant?: "default" | "table";
}) {
  if (refs.length === 0) {
    return variant === "table" ? (
      <span className="text-[11px] text-muted-foreground/50">—</span>
    ) : null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {refs.map((ref) => (
        <Link
          key={ref.quotation_id}
          href={quotationDetailPath(ref.quotation_id, ref.serial_number)}
          title={`${quotationBadgeLabel(ref)} · ${QUOTATION_STATUS_LABELS[ref.status]}`}
          className="inline-flex max-w-full"
          onClick={(event) => event.stopPropagation()}
        >
          <span
            className={cn(
              "inline-flex h-5 max-w-full items-center truncate rounded-full border px-2 text-[10px] font-semibold",
              "border-[#1D9E75]/25 bg-[#1D9E75]/10 text-[#1D9E75]",
              "hover:bg-[#1D9E75]/15 dark:border-[#1D9E75]/35 dark:bg-[#1D9E75]/15"
            )}
          >
            Quoted
            <span className="mx-1 opacity-40">·</span>
            <span className="truncate">{quotationBadgeLabel(ref)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
