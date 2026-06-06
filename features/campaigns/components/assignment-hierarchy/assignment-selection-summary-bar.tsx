"use client";

import { FileStackIcon, FileTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { showErrorToastOnce, showSuccessToastOnce } from "@/lib/ui/toast-once";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  generateVendorIosFromLinesAction,
  type GenerateVendorIoState,
} from "@/features/io/generate-vendor-io-action";
import { formatMoney } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

const initialVioState: GenerateVendorIoState = { ok: false };

export type AssignmentSelectionTotals = {
  count: number;
  revenue: number;
  cost: number;
  gp: number;
  currency: string | null;
  currencyMixed: boolean;
};

type AssignmentSelectionSummaryBarProps = {
  campaignId: string;
  totals: AssignmentSelectionTotals;
  vioLineIds: string[];
  invoiceLineIds: string[];
  hasInvoiceSelection?: boolean;
  invoiceActionLabel?: "generate" | "regenerate" | null;
  onGenerateInvoice: () => void;
  onAfterOperationalMutation?: () => void;
  className?: string;
};

function buildFormData(campaignId: string, lineIds: string[]): FormData {
  const fd = new FormData();
  fd.set("campaign_id", campaignId);
  fd.set("line_ids", lineIds.join(","));
  return fd;
}

export function AssignmentSelectionSummaryBar({
  campaignId,
  totals,
  vioLineIds,
  invoiceLineIds,
  hasInvoiceSelection = invoiceLineIds.length > 0,
  invoiceActionLabel = "generate",
  onGenerateInvoice,
  onAfterOperationalMutation,
  className,
}: AssignmentSelectionSummaryBarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const visible = totals.count > 0;

  function runVioGenerate() {
    startTransition(async () => {
      const result = await generateVendorIosFromLinesAction(
        initialVioState,
        buildFormData(campaignId, vioLineIds)
      );
      if (result.ok) {
        showSuccessToastOnce(result.message ?? "Vendor IO generated.", {
          id: "assignment-vio-generate",
        });
        onAfterOperationalMutation?.();
        router.refresh();
      } else {
        showErrorToastOnce(result.message ?? "Vendor IO generation failed.", {
          id: "assignment-vio-generate",
        });
      }
    });
  }

  const currencyLabel = totals.currencyMixed
    ? "Mixed"
    : (totals.currency ?? "USD");

  return (
    <div
      className={cn(
        "sticky top-0 z-20 overflow-hidden transition-all duration-200 ease-out",
        visible
          ? "mb-2 max-h-24 opacity-100"
          : "mb-0 max-h-0 opacity-0 pointer-events-none",
        className
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          "rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 shadow-sm backdrop-blur-sm",
          "dark:border-primary/25 dark:bg-primary/10"
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs sm:gap-3">
          <Badge variant="secondary" className="h-6 px-2 text-[11px] font-semibold">
            {totals.count} selected
          </Badge>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <span className="tabular-nums text-foreground">
            <span className="text-muted-foreground">Revenue:</span>{" "}
            <span className="font-semibold">
              {formatMoney(totals.revenue, totals.currency ?? "USD")}
            </span>
          </span>
          <span className="hidden text-muted-foreground md:inline">·</span>
          <span className="tabular-nums text-foreground">
            <span className="text-muted-foreground">Cost:</span>{" "}
            <span className="font-semibold">
              {formatMoney(totals.cost, totals.currency ?? "USD")}
            </span>
          </span>
          <span className="hidden text-muted-foreground md:inline">·</span>
          <span className="tabular-nums text-foreground">
            <span className="text-muted-foreground">GP:</span>{" "}
            <span className="font-semibold text-primary">
              {formatMoney(totals.gp, totals.currency ?? "USD")}
            </span>
          </span>
          <Badge variant="outline" className="h-5 text-[10px] font-medium">
            {currencyLabel}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {vioLineIds.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-8 text-xs"
              disabled={pending}
              onClick={runVioGenerate}
            >
              <FileStackIcon data-icon="inline-start" />
              {pending ? "Generating…" : "Generate Vendor IO"}
            </Button>
          ) : null}
          {hasInvoiceSelection ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={onGenerateInvoice}
            >
              <FileTextIcon data-icon="inline-start" />
              {invoiceActionLabel === "regenerate" ? "Regenerate invoice" : "Generate invoice"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
