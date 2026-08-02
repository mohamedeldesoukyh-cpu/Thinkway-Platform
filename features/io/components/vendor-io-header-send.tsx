"use client";

import { SendIcon } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { usePlatformBulkOperation } from "@/components/workspace/bulk-operations";
import {
  describeVendorIoSendBulkLabel,
  mutateVendorIoSend,
} from "@/features/io/bulk/vendor-io-bulk-mutations";
import type { VendorIoRow } from "@/features/io/types";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { OPERATIONAL_CHROME_LABEL } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { cn } from "@/lib/utils";

type Props = {
  selectedRows: VendorIoRow[];
  onClearSelection: () => void;
  onRetainIds: (ids: string[]) => void;
};

/**
 * Header shortcut for the Platform Bulk Operations Framework (Vendor IO send / manual delivery).
 */
export function VendorIoHeaderSend({
  selectedRows,
  onClearSelection,
  onRetainIds,
}: Props) {
  const { run, isRunning } = usePlatformBulkOperation();
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const selectedCount = selectedRows.length;
  const rowsRef = useRef(selectedRows);
  rowsRef.current = selectedRows;

  const sendLabel = useMemo(
    () => describeVendorIoSendBulkLabel(selectedRows),
    [selectedRows]
  );

  const safeRefresh = useCallback(async () => {
    try {
      refreshAfterOperationalMutation();
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("Unable to refresh the Vendor IO list.");
    }
  }, [refreshAfterOperationalMutation]);

  function sendSelected() {
    if (selectedCount === 0) return;
    const snapshot = [...selectedRows];
    const label = describeVendorIoSendBulkLabel(snapshot);

    void run({
      label,
      items: snapshot,
      getId: (row) => row.id,
      mutate: mutateVendorIoSend,
      entityLabel: "Vendor IO",
      entityLabelPlural: "Vendor IOs",
      refresh: safeRefresh,
      onComplete: (summary) => {
        if (summary.failedIds.length > 0) {
          onRetainIds(summary.failedIds);
          return;
        }
        if (summary.succeeded > 0) onClearSelection();
      },
      onRetryFailed: (failedIds) => {
        const retryRows = rowsRef.current.filter((row) =>
          failedIds.includes(row.id)
        );
        if (retryRows.length === 0) {
          toast.message(
            "Failed Vendor IOs are no longer in the current list. Adjust filters or reload, then retry."
          );
          return;
        }
        onRetainIds(failedIds);
        void run({
          label,
          items: retryRows,
          getId: (row) => row.id,
          mutate: mutateVendorIoSend,
          entityLabel: "Vendor IO",
          entityLabelPlural: "Vendor IOs",
          refresh: safeRefresh,
          onComplete: (summary) => {
            if (summary.failedIds.length > 0) {
              onRetainIds(summary.failedIds);
              return;
            }
            if (summary.succeeded > 0) onClearSelection();
          },
        });
      },
    });
  }

  if (selectedCount === 0) {
    return (
      <span className="hidden text-[11px] text-muted-foreground lg:inline">
        Select rows for bulk send, acceptance, signed docs, or export
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={isRunning}
      onClick={sendSelected}
      className={cn(
        OPERATIONAL_CHROME_LABEL,
        "h-7 gap-1.5 bg-[#1D9E75] px-3 font-semibold text-white shadow-sm hover:bg-[#188a67]"
      )}
    >
      <SendIcon className="size-3.5" />
      {isRunning ? "Updating…" : `${sendLabel} (${selectedCount})`}
    </Button>
  );
}
