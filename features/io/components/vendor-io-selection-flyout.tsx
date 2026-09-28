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
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { hasValidVendorEmail } from "@/lib/io/vendor-io-delivery";

import { usePlatformBulkOperation } from "@/components/workspace/bulk-operations";
import {
  PlatformFloatingBarShell,
  PlatformFloatingBarOverflowMenu,
  type PlatformFloatingBarAction,
} from "@/components/shared/navigation/platform-floating-action-bar";
import {
  describeVendorIoSendBulkLabel,
  downloadTextFile,
  exportVendorIoRowsCsv,
  mutateVendorIoMarkAccepted,
  mutateVendorIoMarkDelivered,
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

function SelectionAction({ action, primary = false }: { action: PlatformFloatingBarAction; primary?: boolean }) {
  const Icon = action.icon;
  return <button type="button" className={`tw-selbar-btn${primary ? " pri" : ""}`} disabled={action.disabled} onClick={action.onClick}>
    {Icon && <Icon className="size-3.5" aria-hidden />}{action.label}
  </button>;
}

function SelectionActions({ actions }: { actions: PlatformFloatingBarAction[] }) {
  return actions.map(action => <SelectionAction key={action.id} action={action} />);
}

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
  const openingDetails = useRef(false);
  useEffect(() => { rowsRef.current = selectedRows; }, [selectedRows]);

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
    const missing = selectedRows.filter(row => !hasValidVendorEmail(row.influencer_email));
    if (missing.length) toast.warning(`${missing.length} Creator IO${missing.length === 1 ? "" : "s"} will not be sent: missing or invalid creator email.`, { description: missing.map(row => row.influencer_name).join(", ") });
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
      id: "manual",
      label: "Mark delivered manually",
      disabled: isRunning,
      onClick: () => {
        if (window.confirm(`Mark ${selectedCount} selected Vendor IOs as delivered manually? No emails will be sent.`)) {
          runOnRows("Mark delivered manually", selectedRows, mutateVendorIoMarkDelivered);
        }
      },
    },
    {
      id: "details",
      label: "Details (select one IO)",
      disabled: isRunning || selectedCount !== 1 || !onOpenDetail,
      onClick: () => {
        if (selectedRows[0] && onOpenDetail) {
          openingDetails.current = true;
          onOpenDetail(selectedRows[0].id);
        }
      },
    },
    {
      id: "pdf",
      label: "Download PDFs",
      icon: DownloadIcon,
      disabled: isRunning,
      onClick: () => {
        for (const row of selectedRows) {
          const link = document.createElement("a");
          link.href = `/api/vendor-ios/${row.id}/document?format=pdf&download=1`;
          link.download = "";
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
      },
    },
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
    <PlatformFloatingBarShell
      visible={selectedCount > 0}
      className="tw-selbar"
      messages={
        isRunning && activeJob ? (
          <span className="text-xs font-medium text-muted-foreground">
            Updating {activeJob.entityLabelPlural} in the background — keep working.
          </span>
        ) : null
      }
    >
      <span className="tw-selbar-n">
        <b>{selectedCount}</b> of {selectableCount} vendor IOs selected
        <button type="button" className="tw-selbar-x" aria-label="Clear selection" disabled={isRunning} onClick={onClearSelection}>✕</button>
        {selectedCount < selectableCount && <button type="button" className="tw-selbar-all" disabled={isRunning} onClick={onSelectAll}>Select all</button>}
      </span>
      <span className="tw-selbar-acts">
        <SelectionAction action={primaryAction} primary />
        <SelectionActions actions={secondaryActions} />
        <PlatformFloatingBarOverflowMenu actions={overflowActions} busy={isRunning} className="tw-selbar-btn" onCloseAutoFocus={(event) => {
          if (openingDetails.current) { event.preventDefault(); openingDetails.current = false; }
        }} />
      </span>
    </PlatformFloatingBarShell>
  );
}

export { platformFloatingBarContentClass as vendorIoFloatingBarContentClass } from "@/components/shared/navigation/platform-floating-action-bar";
