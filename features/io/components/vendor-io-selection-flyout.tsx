"use client";

import {
  CheckCircle2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  FileUpIcon,
  NotebookPenIcon,
  SendIcon,
  WalletCardsIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

import { usePlatformBulkOperation } from "@/components/workspace/bulk-operations";
import {
  PlatformFloatingActionBar,
  type PlatformFloatingBarAction,
} from "@/components/shared/navigation/platform-floating-action-bar";
import {
  describeVendorIoSendBulkLabel,
  downloadTextFile,
  exportVendorIoRowsCsv,
  mutateVendorIoMarkAccepted,
  mutateVendorIoPaymentTerms,
  mutateVendorIoSend,
  mutateVendorIoSignedUrl,
} from "@/features/io/bulk/vendor-io-bulk-mutations";
import type { VendorIoRow } from "@/features/io/types";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";

type VendorIoSelectionFlyoutProps = {
  campaignId: string;
  selectedRows: VendorIoRow[];
  selectableCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  /** Keep failed rows selected after partial success. */
  onRetainIds: (ids: string[]) => void;
  onOpenDetail?: (id: string) => void;
};

export function VendorIoSelectionFlyout({
  campaignId,
  selectedRows,
  selectableCount,
  onSelectAll,
  onClearSelection,
  onRetainIds,
  onOpenDetail,
}: VendorIoSelectionFlyoutProps) {
  const { run, isRunning, activeJob } = usePlatformBulkOperation();
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const selectedCount = selectedRows.length;
  const rowsRef = useRef(selectedRows);
  rowsRef.current = selectedRows;

  const safeRefresh = useCallback(async () => {
    try {
      refreshAfterOperationalMutation();
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("Unable to refresh the Vendor IO list.");
    }
  }, [refreshAfterOperationalMutation]);

  const runOnRows = useCallback(
    (
      label: string,
      rows: VendorIoRow[],
      mutate: (row: VendorIoRow) => Promise<{
        ok: boolean;
        skipped?: boolean;
        message?: string;
        id?: string;
      }>
    ) => {
      if (rows.length === 0) {
        toast.message("No Vendor IOs selected.");
        return;
      }

      void run({
        label,
        items: [...rows],
        getId: (row) => row.id,
        mutate,
        entityLabel: "Vendor IO",
        entityLabelPlural: "Vendor IOs",
        refresh: safeRefresh,
        onComplete: (summary) => {
          if (summary.failedIds.length > 0) {
            onRetainIds(summary.failedIds);
            return;
          }
          if (summary.succeeded > 0) {
            onClearSelection();
          }
        },
        onRetryFailed: (failedIds, retryMutate) => {
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
            mutate: retryMutate,
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
    },
    [onClearSelection, onRetainIds, run, safeRefresh]
  );

  const sendLabel = useMemo(
    () => describeVendorIoSendBulkLabel(selectedRows),
    [selectedRows]
  );

  function sendSelected() {
    runOnRows(sendLabel, selectedRows, mutateVendorIoSend);
  }

  function markAccepted() {
    runOnRows("Mark Accepted", selectedRows, mutateVendorIoMarkAccepted);
  }

  function uploadSignedDocuments() {
    const url = window.prompt(
      "Paste one https signed-document URL to apply to all selected Vendor IOs:"
    );
    if (url == null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("A signed document URL is required.");
      return;
    }
    runOnRows("Upload Signed Documents", selectedRows, (row) =>
      mutateVendorIoSignedUrl(row, trimmed)
    );
  }

  function changePaymentTerms() {
    const terms = window.prompt(
      "Special payment terms to apply to all selected Vendor IOs (leave blank to clear):",
      ""
    );
    if (terms == null) return;
    runOnRows("Change Payment Terms", selectedRows, (row) =>
      mutateVendorIoPaymentTerms(row, terms)
    );
  }

  function exportSelected() {
    if (selectedRows.length === 0) return;
    const csv = exportVendorIoRowsCsv(selectedRows);
    downloadTextFile(
      `vendor-ios-${campaignId.slice(0, 8)}-selected.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
    toast.success(
      `${selectedRows.length} Vendor IO${selectedRows.length === 1 ? "" : "s"} exported successfully.`
    );
  }

  function addNote() {
    const first = selectedRows[0];
    if (!first) return;
    onOpenDetail?.(first.id);
    toast.message(
      selectedRows.length === 1
        ? "Opened Vendor IO detail — add the note there."
        : "Opened the first selected Vendor IO. Add notes in the detail sheet."
    );
  }

  function viewSelectedIos() {
    if (selectedRows.length === 0) return;
    if (selectedRows.length > 8) {
      const proceed = window.confirm(
        `Open ${selectedRows.length} preview tabs? Large selections can be blocked by the browser.`
      );
      if (!proceed) return;
    }

    selectedRows.forEach((row, index) => {
      window.setTimeout(() => {
        window.open(`/ios/vendor/${row.id}/preview`, "_blank", "noopener,noreferrer");
      }, index * 200);
    });

    toast.message(
      selectedRows.length === 1
        ? "Opened Vendor IO preview."
        : `Opening ${selectedRows.length} Vendor IO previews…`
    );
  }

  const primaryAction: PlatformFloatingBarAction = {
    id: "send",
    label: isRunning
      ? `Updating…`
      : `${sendLabel} (${selectedCount})`,
    icon: SendIcon,
    disabled: isRunning,
    loading: isRunning,
    onClick: sendSelected,
  };

  const secondaryActions: PlatformFloatingBarAction[] = [
    {
      id: "accept",
      label: "Mark Accepted",
      icon: CheckCircle2Icon,
      disabled: isRunning,
      onClick: markAccepted,
    },
    {
      id: "signed",
      label: "Upload Signed",
      icon: FileUpIcon,
      disabled: isRunning,
      onClick: uploadSignedDocuments,
    },
  ];

  const overflowActions: PlatformFloatingBarAction[] = [
    {
      id: "export",
      label: "Export Selected",
      icon: DownloadIcon,
      disabled: isRunning,
      onClick: exportSelected,
    },
    {
      id: "terms",
      label: "Change Payment Terms",
      icon: WalletCardsIcon,
      disabled: isRunning,
      onClick: changePaymentTerms,
    },
    {
      id: "note",
      label: "Add Note",
      icon: NotebookPenIcon,
      disabled: isRunning,
      onClick: addNote,
    },
    {
      id: "view",
      label: "View IO",
      icon: ExternalLinkIcon,
      disabled: isRunning,
      onClick: viewSelectedIos,
    },
  ];

  return (
    <PlatformFloatingActionBar
      open={selectedCount > 0}
      selectedCount={selectedCount}
      selectionLabel="vendor IO"
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      overflowActions={overflowActions}
      onClearSelection={isRunning ? () => undefined : onClearSelection}
      onSelectAll={onSelectAll}
      selectableCount={selectableCount}
      busy={false}
      messages={
        isRunning && activeJob ? (
          <span className="text-xs font-medium text-muted-foreground">
            Updating {activeJob.entityLabelPlural} in the background — keep working.
          </span>
        ) : null
      }
    />
  );
}

export { platformFloatingBarContentClass as vendorIoFloatingBarContentClass } from "@/components/shared/navigation/platform-floating-action-bar";
