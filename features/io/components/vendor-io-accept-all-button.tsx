"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlatformBulkOperation } from "@/components/workspace/bulk-operations";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { vendorIoNeedsMarkAccepted } from "@/features/io/bulk/vendor-io-bulk-helpers";
import { mutateVendorIoMarkAccepted } from "@/features/io/bulk/vendor-io-bulk-mutations";
import type { VendorIoRow } from "@/features/io/types";

export function VendorIoAcceptAllButton({ rows }: { rows: VendorIoRow[] }) {
  const hintId = useId();
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
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              className="min-h-11"
              disabled={isRunning}
              aria-describedby={hintId}
              onClick={() => acceptRows(eligible)}
            >
              {isRunning ? "Bulk update in progress…" : `Accept All Manually (${eligible.length})`}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Records offline creator acceptance for all {eligible.length} eligible sent or manually
            delivered Vendor IOs in this campaign, including rows outside the current table filter.
            Records your name and the time, and updates approval counts. No email is sent;
            signed documents must be uploaded separately.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <p id={hintId} className="text-sm text-muted-foreground">
        Use after all {eligible.length} creators have confirmed acceptance offline. Delivery alone
        does not record acceptance.
      </p>
    </div>
  );
}
