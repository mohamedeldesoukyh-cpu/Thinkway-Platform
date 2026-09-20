"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlatformBulkOperation } from "@/components/workspace/bulk-operations";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { vendorIoNeedsMarkAccepted } from "@/features/io/bulk/vendor-io-bulk-helpers";
import { mutateVendorIoMarkAccepted } from "@/features/io/bulk/vendor-io-bulk-mutations";
import type { VendorIoRow } from "@/features/io/types";

export function VendorIoAcceptAllButton({ rows }: { rows: VendorIoRow[] }) {
  const { run, isRunning } = usePlatformBulkOperation();
  const refresh = useRefreshCampaignAfterOperationalMutation();
  const eligible = rows.filter(vendorIoNeedsMarkAccepted);

  function acceptRows(items: VendorIoRow[]) {
    void run({
      label: "Accept All Manually",
      items,
      getId: (row) => row.id,
      mutate: mutateVendorIoMarkAccepted,
      entityLabel: "Vendor IO",
      entityLabelPlural: "Vendor IOs",
      refresh,
      onRetryFailed: (ids) => acceptRows(items.filter((row) => ids.includes(row.id))),
    });
  }

  if (eligible.length === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="tw-b sm pri"
            disabled={isRunning}
            onClick={() => acceptRows(eligible)}
          >
            {isRunning ? "Accepting…" : `Accept All Manually (${eligible.length})`}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Use after the creators have confirmed acceptance offline.
          Records offline creator acceptance for all {eligible.length} eligible sent or manually
          delivered Vendor IOs in this campaign, including rows outside the current table filter.
          Records your name and the time, and updates approval counts. No email is sent;
          signed documents must be uploaded separately.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
