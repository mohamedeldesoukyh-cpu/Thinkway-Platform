"use client";

import { ExternalLinkIcon, SendIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  PlatformFloatingActionBar,
  type PlatformFloatingBarAction,
} from "@/components/shared/navigation/platform-floating-action-bar";
import { sendVendorIoAction } from "@/features/io/actions";
import type { VendorIoRow } from "@/features/io/types";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";

type VendorIoSelectionFlyoutProps = {
  campaignId: string;
  selectedRows: VendorIoRow[];
  selectableCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
};

export function VendorIoSelectionFlyout({
  campaignId,
  selectedRows,
  selectableCount,
  onSelectAll,
  onClearSelection,
}: VendorIoSelectionFlyoutProps) {
  const [pending, startTransition] = useTransition();
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const selectedCount = selectedRows.length;

  function sendSelected() {
    startTransition(async () => {
      let sent = 0;
      let failed = 0;
      let lastError: string | undefined;

      for (const row of selectedRows) {
        const formData = new FormData();
        formData.set("id", row.id);
        formData.set("campaign_header_id", row.campaign_header_id);

        const result = await sendVendorIoAction({ ok: false }, formData);
        if (result.ok) sent += 1;
        else {
          failed += 1;
          lastError = result.message;
        }
      }

      if (sent > 0) {
        toast.success(
          `Sent ${sent} vendor IO${sent === 1 ? "" : "s"}.` +
            (failed > 0 ? ` ${failed} failed.` : "")
        );
        onClearSelection();
        refreshAfterOperationalMutation();
      } else {
        toast.error(lastError ?? "No vendor IOs were sent.");
      }
    });
  }

  function viewSelectedIos() {
    if (selectedRows.length === 0) return;

    selectedRows.forEach((row, index) => {
      window.setTimeout(() => {
        window.open(`/ios/vendor/${row.id}/preview`, "_blank", "noopener,noreferrer");
      }, index * 200);
    });

    toast.message(
      selectedRows.length === 1
        ? "Opened vendor IO preview."
        : `Opening ${selectedRows.length} vendor IO previews…`
    );
  }

  const primaryAction: PlatformFloatingBarAction = {
    id: "send",
    label: pending ? "Sending…" : "Send selected",
    icon: SendIcon,
    disabled: pending,
    loading: pending,
    onClick: sendSelected,
  };

  const secondaryActions: PlatformFloatingBarAction[] = [
    {
      id: "view",
      label: "View IO",
      icon: ExternalLinkIcon,
      disabled: pending,
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
      onClearSelection={onClearSelection}
      onSelectAll={onSelectAll}
      selectableCount={selectableCount}
      busy={pending}
    />
  );
}

export { platformFloatingBarContentClass as vendorIoFloatingBarContentClass } from "@/components/shared/navigation/platform-floating-action-bar";
